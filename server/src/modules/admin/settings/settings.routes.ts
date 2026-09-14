import { Router, type NextFunction, type Request, type Response } from 'express';
import { updateStoreSettingsInputSchema } from '@audio-commerce/shared';
import { validate } from '../../../middleware/validate.js';
import * as controller from './settings.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

export const adminSettingsRouter = Router();

adminSettingsRouter.get('/', asyncHandler(controller.getSettingsHandler));
adminSettingsRouter.patch('/', validate(updateStoreSettingsInputSchema), asyncHandler(controller.updateSettingsHandler));
