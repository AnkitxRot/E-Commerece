import { Router } from 'express';
import { Role } from '@audio-commerce/shared';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { dashboardRouter } from './dashboard.routes.js';
import { adminProductsRouter } from './products.routes.js';
import { adminOrdersRouter } from './orders/orders.routes.js';
import { adminCategoriesRouter } from './categories/categories.routes.js';
import { adminBrandsRouter } from './brands/brands.routes.js';
import { adminReviewsRouter } from './reviews/reviews.routes.js';
import { adminSettingsRouter } from './settings/settings.routes.js';
import { adminContentBlocksRouter } from './content-blocks/content-blocks.routes.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));
adminRouter.use(dashboardRouter);
adminRouter.use('/categories', adminCategoriesRouter);
adminRouter.use('/brands', adminBrandsRouter);
adminRouter.use('/products', adminProductsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/reviews', adminReviewsRouter);
adminRouter.use('/settings', adminSettingsRouter);
adminRouter.use('/content-blocks', adminContentBlocksRouter);
