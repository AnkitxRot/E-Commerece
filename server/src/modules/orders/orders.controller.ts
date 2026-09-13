import type { Request, Response } from 'express';
import type { CreateOrderInput } from '@audio-commerce/shared';
import * as ordersService from './orders.service.js';

export async function createOrderHandler(req: Request, res: Response) {
  const { shippingAddress } = req.body as CreateOrderInput;
  const order = await ordersService.createOrder(req.user!.id, shippingAddress);
  res.status(201).json({ order });
}

export async function listOrdersHandler(req: Request, res: Response) {
  const orders = await ordersService.listOrdersForUser(req.user!.id);
  res.status(200).json({ orders });
}

export async function getOrderHandler(req: Request, res: Response) {
  const order = await ordersService.getOrderById(req.user!.id, req.user!.role, req.params.orderId);
  res.status(200).json({ order });
}
