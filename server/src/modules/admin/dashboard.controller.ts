import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.js';

export async function getDashboardHandler(_req: Request, res: Response) {
  const dashboard = await dashboardService.getDashboard();
  res.status(200).json(dashboard);
}
