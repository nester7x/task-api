import asyncHandler from 'express-async-handler';
import User from '../models/user.model';
import type { Request, Response, NextFunction } from 'express';

export const checkRole = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user?.id);

    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied: admins only' });
      return;
    }

    next();
  }
);