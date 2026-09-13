import type { Request, Response } from 'express';
import type { AdminOrderListQuery, UpdateOrderStatusInput } from '@audio-commerce/shared';
import * as ordersService from './orders.service.js';

export async function listOrdersHandler(req: Request, res: Response) {
  const result = await ordersService.listOrders(req.query as unknown as AdminOrderListQuery);
  res.status(200).json(result);
}

export async function getOrderHandler(req: Request, res: Response) {
  const order = await ordersService.getOrderById(req.params.id);
  res.status(200).json({ order });
}

export async function updateOrderStatusHandler(req: Request, res: Response) {
  const { status } = req.body as UpdateOrderStatusInput;
  const order = await ordersService.updateOrderStatus(req.user!.id, req.params.id, status);
  res.status(200).json({ order });
}
