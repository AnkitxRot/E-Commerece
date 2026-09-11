import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { signAccessToken } from '../../auth/jwt.js';
import { generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from '../../auth/refreshToken.js';
import { ConflictError, UnauthorizedError } from '../../errors/AppError.js';
import type { RegisterInput, LoginInput, UserDto, Role } from '@audio-commerce/shared';

function toUserDto(user: { id: string; email: string; name: string; role: Role }): UserDto {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

async function issueTokenPair(userId: string, role: Role, familyId: string) {
  const accessToken = signAccessToken({ sub: userId, role });
  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      familyId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return { accessToken, refreshToken: rawRefreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { email: input.email, passwordHash, name: input.name },
  });
  const tokens = await issueTokenPair(user.id, user.role as Role, randomUUID());
  return { user: toUserDto({ ...user, role: user.role as Role }), ...tokens };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError('Invalid email or password');
  }
  const tokens = await issueTokenPair(user.id, user.role as Role, randomUUID());
  return { user: toUserDto({ ...user, role: user.role as Role }), ...tokens };
}

async function revokeFamily(familyId: string) {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function refresh(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) throw new UnauthorizedError('Invalid refresh token');
  if (existing.expiresAt < new Date()) throw new UnauthorizedError('Refresh token expired');

  if (existing.revokedAt) {
    // Reuse of an already-rotated token: assume compromise, kill the whole family.
    await revokeFamily(existing.familyId);
    throw new UnauthorizedError('Session invalid, please log in again');
  }

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) {
    // The user was deleted after this token was issued — never leak that as a 500.
    await revokeFamily(existing.familyId);
    throw new UnauthorizedError('Session invalid, please log in again');
  }

  const newRawToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRawToken);

  // Revoke-old + create-new happen atomically: either both land, or neither
  // does, so a crash mid-rotation can never leave a revoked token with no
  // replacement. The `revokedAt: null` guard inside the same transaction is
  // still what makes concurrent-refresh-of-the-same-token safe (see below).
  let rotatedCount = 0;
  await prisma.$transaction(async (tx) => {
    const rotated = await tx.refreshToken.updateMany({
      where: { id: existing.id, revokedAt: null },
      data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
    });
    rotatedCount = rotated.count;
    if (rotatedCount === 0) return; // handled after the transaction commits/rolls back
    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        familyId: existing.familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
  });

  if (rotatedCount === 0) {
    // Two requests raced on the same not-yet-revoked token; the loser's
    // `count === 0` means someone else already rotated it a moment ago —
    // treated the same as replay-of-a-revoked-token (family-wide revoke).
    await revokeFamily(existing.familyId);
    throw new UnauthorizedError('Session invalid, please log in again');
  }

  // Re-derive the role from the live row (not a cached value) so a role
  // change reaches the client's next refresh — see the documented stale-role
  // tradeoff in the plan's Global Constraints.
  const accessToken = signAccessToken({ sub: user.id, role: user.role as Role });
  return { accessToken, refreshToken: newRawToken };
}

export async function logout(rawToken: string) {
  const tokenHash = hashRefreshToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(id: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    // The JWT's subject no longer exists (deleted between issuance and use) —
    // this is an auth failure from the caller's perspective, never a 500.
    throw new UnauthorizedError('Session invalid, please log in again');
  }
  return toUserDto({ ...user, role: user.role as Role });
}
