import type { Request, Response } from 'express';
import type { AddWishlistItemInput } from '@audio-commerce/shared';
import * as wishlistService from './wishlist.service.js';

export async function getWishlistHandler(req: Request, res: Response) {
  const wishlist = await wishlistService.getWishlist(req.user!.id);
  res.status(200).json(wishlist);
}

export async function addItemHandler(req: Request, res: Response) {
  const { slug } = req.body as AddWishlistItemInput;
  const wishlist = await wishlistService.addItem(req.user!.id, slug);
  res.status(200).json(wishlist);
}

export async function removeItemHandler(req: Request, res: Response) {
  const wishlist = await wishlistService.removeItem(req.user!.id, req.params.slug);
  res.status(200).json(wishlist);
}
