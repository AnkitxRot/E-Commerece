import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createAddressInputSchema, updateAddressInputSchema } from '@audio-commerce/shared';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import * as controller from './addresses.controller.js';

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const addressesRouter = Router();

addressesRouter.use(requireAuth);
addressesRouter.get('/', asyncHandler(controller.listAddressesHandler));
addressesRouter.post('/', validate(createAddressInputSchema), asyncHandler(controller.createAddressHandler));
addressesRouter.patch(
  '/:id',
  validate(idParamsSchema, 'params'),
  validate(updateAddressInputSchema),
  asyncHandler(controller.updateAddressHandler),
);
addressesRouter.delete('/:id', validate(idParamsSchema, 'params'), asyncHandler(controller.deleteAddressHandler));
addressesRouter.post(
  '/:id/default',
  validate(idParamsSchema, 'params'),
  asyncHandler(controller.setDefaultAddressHandler),
);
