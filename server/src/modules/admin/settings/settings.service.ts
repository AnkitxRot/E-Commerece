import type { Prisma, StoreSettings } from '@prisma/client';
import type { AdminStoreSettingsDto, UpdateStoreSettingsInput } from '@audio-commerce/shared';
import { prisma } from '../../../lib/prisma.js';
import { NotFoundError } from '../../../errors/AppError.js';
import { recordAudit } from '../audit.js';

const SINGLETON_ID = 'singleton';

function toDto(row: StoreSettings): AdminStoreSettingsDto {
  return {
    storeName: row.storeName,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    socialLinks: row.socialLinks as AdminStoreSettingsDto['socialLinks'],
    heroContent: row.heroContent as AdminStoreSettingsDto['heroContent'],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAdminSettings(): Promise<AdminStoreSettingsDto> {
  const settings = await prisma.storeSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!settings) throw new NotFoundError('Store settings not found');
  return toDto(settings);
}

// StoreSettings is a fixed singleton row (seeded once, never created or
// deleted through the API) — this is the only write operation it has.
export async function updateSettings(actorId: string, input: UpdateStoreSettingsInput): Promise<AdminStoreSettingsDto> {
  const existing = await prisma.storeSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!existing) throw new NotFoundError('Store settings not found');

  const updated = await prisma.$transaction(async (tx) => {
    const settings = await tx.storeSettings.update({
      where: { id: SINGLETON_ID },
      data: {
        storeName: input.storeName,
        logoUrl: input.logoUrl,
        faviconUrl: input.faviconUrl,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        socialLinks: input.socialLinks as Prisma.InputJsonValue | undefined,
        heroContent: input.heroContent as Prisma.InputJsonValue | undefined,
      },
    });
    await recordAudit(actorId, 'settings.update', 'StoreSettings', settings.id, input as Prisma.InputJsonValue, tx);
    return settings;
  });

  return toDto(updated);
}
