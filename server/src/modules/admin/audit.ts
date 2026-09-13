import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export async function recordAudit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  diff: Prisma.InputJsonValue,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, diff } });
}
