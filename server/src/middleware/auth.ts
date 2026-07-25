import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    sessionId?: string;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.sessionId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}
