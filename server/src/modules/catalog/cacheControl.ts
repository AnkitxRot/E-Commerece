import type { NextFunction, Request, Response } from 'express';

export function publicCatalogCache(req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      res.setHeader('Cache-Control', 'no-store');
    } else if (req.headers.authorization || req.cookies?.refreshToken) {
      res.setHeader('Cache-Control', 'private, max-age=15');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    }
    return original(body);
  }) as Response['json'];
  next();
}
