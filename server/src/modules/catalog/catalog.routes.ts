import { Router, type NextFunction, type Request, type Response } from 'express';
import { catalogSlugParamSchema, productListQuerySchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { publicCatalogCache } from './cacheControl.js';
import * as controller from './catalog.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const catalogRouter = Router();

catalogRouter.use(publicCatalogCache);
catalogRouter.get('/settings', asyncHandler(controller.getSettingsHandler));
catalogRouter.get('/categories', asyncHandler(controller.getCategoryTreeHandler));
catalogRouter.get('/categories/:slug', validate(catalogSlugParamSchema, 'params'), asyncHandler(controller.getCategoryBySlugHandler));
catalogRouter.get('/brands', asyncHandler(controller.getBrandsHandler));
catalogRouter.get('/products', validate(productListQuerySchema, 'query'), asyncHandler(controller.listProductsHandler));
