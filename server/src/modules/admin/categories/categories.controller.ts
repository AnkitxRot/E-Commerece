import type { Request, Response } from 'express';
import type { CreateCategoryInput, UpdateCategoryInput } from '@audio-commerce/shared';
import * as categoriesService from './categories.service.js';

export async function listCategoriesHandler(_req: Request, res: Response) {
  res.status(200).json(await categoriesService.listCategories());
}

export async function createCategoryHandler(req: Request, res: Response) {
  const category = await categoriesService.createCategory(req.user!.id, req.body as CreateCategoryInput);
  res.status(201).json({ category });
}

export async function updateCategoryHandler(req: Request, res: Response) {
  const category = await categoriesService.updateCategory(
    req.user!.id,
    req.params.id,
    req.body as UpdateCategoryInput,
  );
  res.status(200).json({ category });
}

export async function deleteCategoryHandler(req: Request, res: Response) {
  await categoriesService.deleteCategory(req.user!.id, req.params.id);
  res.status(204).send();
}
