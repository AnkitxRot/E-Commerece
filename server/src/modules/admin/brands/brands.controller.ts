import type { Request, Response } from 'express';
import type { CreateBrandInput, UpdateBrandInput } from '@audio-commerce/shared';
import * as brandsService from './brands.service.js';

export async function listBrandsHandler(_req: Request, res: Response) {
  res.status(200).json(await brandsService.listBrands());
}

export async function createBrandHandler(req: Request, res: Response) {
  const brand = await brandsService.createBrand(req.user!.id, req.body as CreateBrandInput);
  res.status(201).json({ brand });
}

export async function updateBrandHandler(req: Request, res: Response) {
  const brand = await brandsService.updateBrand(req.user!.id, req.params.id, req.body as UpdateBrandInput);
  res.status(200).json({ brand });
}

export async function deleteBrandHandler(req: Request, res: Response) {
  await brandsService.deleteBrand(req.user!.id, req.params.id);
  res.status(204).send();
}
