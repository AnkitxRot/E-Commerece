import { Router, type NextFunction, type Request, type Response } from 'express';
import * as controller from './lookups.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const adminLookupsRouter = Router();

adminLookupsRouter.get('/categories', asyncHandler(controller.listCategoriesHandler));
adminLookupsRouter.get('/brands', asyncHandler(controller.listBrandsHandler));
