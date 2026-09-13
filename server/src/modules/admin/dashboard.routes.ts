import { Router, type NextFunction, type Request, type Response } from 'express';
import * as controller from './dashboard.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const dashboardRouter = Router();

dashboardRouter.get('/overview', asyncHandler(controller.getDashboardHandler));
