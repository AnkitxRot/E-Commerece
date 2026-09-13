import type { Request, Response } from 'express';
import * as lookupsService from './lookups.service.js';

export async function listCategoriesHandler(_req: Request, res: Response) {
  res.status(200).json(await lookupsService.listCategoryOptions());
}

export async function listBrandsHandler(_req: Request, res: Response) {
  res.status(200).json(await lookupsService.listBrandOptions());
}
