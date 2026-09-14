import type { Request, Response } from 'express';
import type { CreateAddressInput, UpdateAddressInput } from '@audio-commerce/shared';
import * as addressesService from './addresses.service.js';

export async function listAddressesHandler(req: Request, res: Response) {
  const addresses = await addressesService.listAddresses(req.user!.id);
  res.status(200).json({ addresses });
}

export async function createAddressHandler(req: Request, res: Response) {
  const address = await addressesService.createAddress(req.user!.id, req.body as CreateAddressInput);
  res.status(201).json({ address });
}

export async function updateAddressHandler(req: Request, res: Response) {
  const address = await addressesService.updateAddress(req.user!.id, req.params.id, req.body as UpdateAddressInput);
  res.status(200).json({ address });
}

export async function deleteAddressHandler(req: Request, res: Response) {
  await addressesService.deleteAddress(req.user!.id, req.params.id);
  res.status(204).send();
}

export async function setDefaultAddressHandler(req: Request, res: Response) {
  const address = await addressesService.setDefaultAddress(req.user!.id, req.params.id);
  res.status(200).json({ address });
}
