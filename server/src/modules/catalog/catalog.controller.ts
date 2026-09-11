import type { Request, Response } from 'express';
import * as catalogService from './catalog.service.js';

export async function getSettingsHandler(_req: Request, res: Response) {
  const settings = await catalogService.getSettings();
  res.status(200).json(settings);
}

export async function getCategoryTreeHandler(_req: Request, res: Response) {
  const tree = await catalogService.getCategoryTree();
  res.status(200).json(tree);
}

export async function getCategoryBySlugHandler(req: Request, res: Response) {
  const category = await catalogService.getCategoryBySlug(req.params.slug);
  res.status(200).json(category);
}

export async function getBrandsHandler(_req: Request, res: Response) {
  const brands = await catalogService.getBrands();
  res.status(200).json(brands);
}
