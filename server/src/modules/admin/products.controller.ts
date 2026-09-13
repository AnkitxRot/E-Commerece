import type { Request, Response } from 'express';
import type {
  AdminProductListQuery,
  CreateProductInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '@audio-commerce/shared';
import * as productsService from './products.service.js';

export async function listProductsHandler(req: Request, res: Response) {
  const result = await productsService.listProducts(req.query as unknown as AdminProductListQuery);
  res.status(200).json(result);
}

export async function getProductHandler(req: Request, res: Response) {
  const product = await productsService.getProductById(req.params.id);
  res.status(200).json({ product });
}

export async function createProductHandler(req: Request, res: Response) {
  const product = await productsService.createProduct(req.user!.id, req.body as CreateProductInput);
  res.status(201).json({ product });
}

export async function updateProductHandler(req: Request, res: Response) {
  const product = await productsService.updateProduct(req.user!.id, req.params.id, req.body as UpdateProductInput);
  res.status(200).json({ product });
}

export async function updateVariantHandler(req: Request, res: Response) {
  const product = await productsService.updateVariant(
    req.user!.id,
    req.params.id,
    req.params.variantId,
    req.body as UpdateVariantInput,
  );
  res.status(200).json({ product });
}
