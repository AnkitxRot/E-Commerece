import type { Request, Response } from 'express';
import type {
  AdminProductListQuery,
  CreateProductImageInput,
  CreateProductInput,
  UpdateProductImageInput,
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

export async function addImageHandler(req: Request, res: Response) {
  const product = await productsService.addImage(req.user!.id, req.params.id, req.body as CreateProductImageInput);
  res.status(201).json({ product });
}

export async function updateImageHandler(req: Request, res: Response) {
  const product = await productsService.updateImage(
    req.user!.id,
    req.params.id,
    req.params.imageId,
    req.body as UpdateProductImageInput,
  );
  res.status(200).json({ product });
}

export async function deleteImageHandler(req: Request, res: Response) {
  const product = await productsService.deleteImage(req.user!.id, req.params.id, req.params.imageId);
  res.status(200).json({ product });
}
