import { Router } from 'express';
import { Role } from '@audio-commerce/shared';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { dashboardRouter } from './dashboard.routes.js';
import { adminProductsRouter } from './products.routes.js';
import { adminOrdersRouter } from './orders/orders.routes.js';
import { adminLookupsRouter } from './lookups.routes.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));
adminRouter.use(dashboardRouter);
adminRouter.use(adminLookupsRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/orders', adminOrdersRouter);
