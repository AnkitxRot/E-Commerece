import { Prisma, type Address } from '@prisma/client';
import type { AddressDto, CreateAddressInput, UpdateAddressInput } from '@audio-commerce/shared';
import type { ShippingAddressInput } from '@audio-commerce/shared';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../errors/AppError.js';

const MAX_DEFAULT_RACE_ATTEMPTS = 3;

/**
 * Matches on `target` including 'userId' rather than the (unavailable)
 * index name, since Prisma doesn't know about this raw partial index. This
 * assumes the wrapped $transaction only ever touches Address — if a future
 * change adds a Cart or Wishlist write (both also have a plain `userId`
 * unique constraint) inside the same transaction, a violation there would
 * be misread as a default-address race too. Not a bug today; worth
 * re-checking if that assumption ever changes.
 */
function isDefaultUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === 'P2002' &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes('userId')
  );
}

/** The address was deleted between an ownership check and the write that
 * follows it — a narrow, legitimate race (not an error worth retrying),
 * reported the same way as any other "not yours or doesn't exist" case. */
function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

/**
 * Retries an operation that changes which address is the user's default
 * when it loses a race against a concurrent one. The DB's partial unique
 * index (`Address_userId_default_key`, see schema.prisma) is what actually
 * detects the race — Postgres rejects the losing transaction's commit
 * rather than silently allowing two rows to end up isDefault:true — and
 * because each attempt runs inside its own `$transaction`, a rejected
 * attempt leaves nothing behind to retry against; re-running the whole
 * operation is always safe, never risks a duplicate.
 */
async function retryOnDefaultRace<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_DEFAULT_RACE_ATTEMPTS; attempt++) {
    try {
      return await operation();
    } catch (err) {
      if (!isDefaultUniqueViolation(err) || attempt === MAX_DEFAULT_RACE_ATTEMPTS) throw err;
    }
  }
  throw new ConflictError('Could not update the default address right now — please try again.');
}

function toDto(row: Address): AddressDto {
  return {
    id: row.id,
    label: row.label,
    line1: row.line1,
    line2: row.line2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    phone: row.phone,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAddresses(userId: string): Promise<AddressDto[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toDto);
}

export async function createAddress(userId: string, input: CreateAddressInput): Promise<AddressDto> {
  const created = await retryOnDefaultRace(() =>
    prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      }
      return tx.address.create({
        data: {
          userId,
          label: input.label,
          line1: input.line1,
          line2: input.line2 ?? null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          phone: input.phone,
          isDefault: input.isDefault ?? false,
        },
      });
    }),
  );
  return toDto(created);
}

async function findOwnedAddress(userId: string, id: string): Promise<Address> {
  // findFirst scoped to (id, userId), not findUnique(id) followed by an
  // ownership check — the same pattern cart.service.ts uses for cart items.
  // A mismatch is reported as 404, never 403: this never confirms to the
  // caller whether an address with that id exists for someone else.
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw new NotFoundError('Address not found');
  return address;
}

export async function updateAddress(userId: string, id: string, input: UpdateAddressInput): Promise<AddressDto> {
  await findOwnedAddress(userId, id);
  try {
    const updated = await prisma.address.update({
      where: { id },
      data: {
        label: input.label,
        line1: input.line1,
        line2: input.line2 === undefined ? undefined : (input.line2 ?? null),
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        phone: input.phone,
      },
    });
    return toDto(updated);
  } catch (err) {
    if (isRecordNotFound(err)) throw new NotFoundError('Address not found');
    throw err;
  }
}

export async function deleteAddress(userId: string, id: string): Promise<void> {
  // Deleting the current default intentionally leaves zero defaults rather
  // than auto-promoting another address — an explicit, predictable choice
  // over an implicit one; the customer chooses the next default themselves.
  const result = await prisma.address.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new NotFoundError('Address not found');
}

export async function setDefaultAddress(userId: string, id: string): Promise<AddressDto> {
  const existing = await findOwnedAddress(userId, id);
  if (existing.isDefault) return toDto(existing);

  try {
    const updated = await retryOnDefaultRace(() =>
      prisma.$transaction(async (tx) => {
        await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
        return tx.address.update({ where: { id }, data: { isDefault: true } });
      }),
    );
    return toDto(updated);
  } catch (err) {
    if (isRecordNotFound(err)) throw new NotFoundError('Address not found');
    throw err;
  }
}

/**
 * Resolves a saved address into the same shape a manually-typed checkout
 * address takes, for orders.service.ts to store as a plain snapshot — the
 * order never holds a live reference to this Address row. There is no
 * recipient-name field on Address (addresses are for the account holder),
 * so fullName comes from the user's own name.
 */
export async function resolveShippingAddressForCheckout(
  userId: string,
  addressId: string,
): Promise<ShippingAddressInput> {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
    include: { user: { select: { name: true } } },
  });
  if (!address) throw new NotFoundError('Address not found');

  return {
    fullName: address.user.name,
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
  };
}
