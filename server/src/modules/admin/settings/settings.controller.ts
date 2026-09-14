import type { Request, Response } from 'express';
import type { UpdateStoreSettingsInput } from '@audio-commerce/shared';
import * as settingsService from './settings.service.js';

export async function getSettingsHandler(_req: Request, res: Response) {
  const settings = await settingsService.getAdminSettings();
  res.status(200).json({ settings });
}

export async function updateSettingsHandler(req: Request, res: Response) {
  const settings = await settingsService.updateSettings(req.user!.id, req.body as UpdateStoreSettingsInput);
  res.status(200).json({ settings });
}
