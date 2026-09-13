import type { Request, Response } from 'express';
import type { AddCartItemInput, UpdateCartItemInput } from '@audio-commerce/shared';
import * as cartService from './cart.service.js';

export async function getCartHandler(req: Request, res: Response) {
  const cart = await cartService.getCart(req.user!.id);
  res.status(200).json(cart);
}

export async function addItemHandler(req: Request, res: Response) {
  const { variantId, qty } = req.body as AddCartItemInput;
  const cart = await cartService.addItem(req.user!.id, variantId, qty);
  res.status(200).json(cart);
}

export async function updateItemHandler(req: Request, res: Response) {
  const { qty } = req.body as UpdateCartItemInput;
  const cart = await cartService.updateItemQty(req.user!.id, req.params.itemId, qty);
  res.status(200).json(cart);
}

export async function removeItemHandler(req: Request, res: Response) {
  const cart = await cartService.removeItem(req.user!.id, req.params.itemId);
  res.status(200).json(cart);
}

export async function clearCartHandler(req: Request, res: Response) {
  const cart = await cartService.clearCart(req.user!.id);
  res.status(200).json(cart);
}
