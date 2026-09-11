import { Router } from 'express';
import { Role } from '@audio-commerce/shared';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const adminRouter = Router();

adminRouter.get('/overview', requireAuth, requireRole(Role.ADMIN), (_req, res) => {
  res.status(200).json({ message: 'Admin area placeholder' });
});
