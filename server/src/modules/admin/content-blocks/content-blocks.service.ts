import { Prisma, type ContentBlock } from '@prisma/client';
import { contentBlockPayloadSchemaByType } from '@audio-commerce/shared';
import type {
  AdminContentBlockDto,
  AdminContentBlockListResponse,
  CreateContentBlockInput,
  UpdateContentBlockInput,
} from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../../errors/AppError.js';
import { recordAudit } from '../audit.js';

function toDto(row: ContentBlock): AdminContentBlockDto {
  return {
    id: row.id,
    type: row.type as AdminContentBlockDto['type'],
    payload: row.payload as AdminContentBlockDto['payload'],
    position: row.position,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listContentBlocks(): Promise<AdminContentBlockListResponse> {
  const rows = await prisma.contentBlock.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] });
  return { blocks: rows.map(toDto) };
}

export async function createContentBlock(
  actorId: string,
  input: CreateContentBlockInput,
): Promise<AdminContentBlockDto> {
  const created = await prisma.$transaction(async (tx) => {
    const block = await tx.contentBlock.create({
      data: {
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        position: input.position,
        active: input.active ?? true,
      },
    });
    await recordAudit(actorId, 'contentBlock.create', 'ContentBlock', block.id, { type: block.type, position: block.position }, tx);
    return block;
  });
  return toDto(created);
}

export async function updateContentBlock(
  actorId: string,
  id: string,
  input: UpdateContentBlockInput,
): Promise<AdminContentBlockDto> {
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Content block not found');

  // type is immutable (see updateContentBlockInputSchema's comment), so a
  // payload update is always validated against the block's OWN existing
  // type — reusing the exact same per-type schema the public home page
  // validates against, not a second, possibly-drifting definition.
  let validatedPayload: Prisma.InputJsonValue | undefined;
  if (input.payload !== undefined) {
    const payloadSchema = contentBlockPayloadSchemaByType[existing.type];
    const result = payloadSchema.safeParse(input.payload);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid payload for this block type');
    }
    validatedPayload = result.data as Prisma.InputJsonValue;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const block = await tx.contentBlock.update({
        where: { id },
        data: { payload: validatedPayload, position: input.position, active: input.active },
      });
      await recordAudit(actorId, 'contentBlock.update', 'ContentBlock', id, input as Prisma.InputJsonValue, tx);
      return block;
    });
    return toDto(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError('Content block not found');
    }
    throw err;
  }
}

export async function deleteContentBlock(actorId: string, id: string): Promise<void> {
  const existing = await prisma.contentBlock.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Content block not found');

  try {
    await prisma.$transaction(async (tx) => {
      await tx.contentBlock.delete({ where: { id } });
      await recordAudit(actorId, 'contentBlock.delete', 'ContentBlock', id, { type: existing.type }, tx);
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new NotFoundError('Content block not found');
    }
    throw err;
  }
}
