import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    googleUserId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.googleUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
