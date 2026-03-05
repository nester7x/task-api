import asyncHandler from 'express-async-handler';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import User from '../db/models/user.model';

interface DecodedToken extends JwtPayload {
  user: {
    username: string;
    email: string;
    id: string;
  };
}

export const verifyJwt = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (!token) {
        res.status(401).json({ error: 'Authorization token is missing' });
        return;
      }

      jwt.verify(token, process.env.JWT_ACCESS_SECRET as string, (err, decoded) => {
        if (err) {
          res.status(401).json({ error: 'Invalid token' });
          return;
        }
        req.user = (decoded as DecodedToken).user;
        next();
      });
    } else {
      res.status(401).json({ error: 'Authorization token is missing' });
    }
  }
);

export const requireRole = (role: 'admin' | 'user') =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = await User.findById(req.user?.id);

    if (!user || user.role !== role) {
      res.status(403).json({ error: `Access denied: ${role}s only` });
      return;
    }

    next();
  });