import type { Request, Response } from 'express';
import type { CreateContentBlockInput, UpdateContentBlockInput } from '@audio-commerce/shared';
import * as contentBlocksService from './content-blocks.service.js';

export async function listContentBlocksHandler(_req: Request, res: Response) {
  res.status(200).json(await contentBlocksService.listContentBlocks());
}

export async function createContentBlockHandler(req: Request, res: Response) {
  const block = await contentBlocksService.createContentBlock(req.user!.id, req.body as CreateContentBlockInput);
  res.status(201).json({ block });
}

export async function updateContentBlockHandler(req: Request, res: Response) {
  const block = await contentBlocksService.updateContentBlock(
    req.user!.id,
    req.params.id,
    req.body as UpdateContentBlockInput,
  );
  res.status(200).json({ block });
}

export async function deleteContentBlockHandler(req: Request, res: Response) {
  await contentBlocksService.deleteContentBlock(req.user!.id, req.params.id);
  res.status(204).send();
}
