import { z } from 'zod';
import type { Request, Response } from 'express';
import { registerUser, EmailAlreadyExistsError, loginUser, InvalidCredentialsError } from '../services/auth.service';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const register = async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } });
    return;
  }

  try {
    await registerUser(parsed.data.email, parsed.data.password);
    res.status(201).json({ data: { message: 'Registration successful' } });
  } catch (e) {
    if (e instanceof EmailAlreadyExistsError) {
      res.status(409).json({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'An account with this email already exists' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (e as Error).message } });
  }
};

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const login = async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } });
    return;
  }

  try {
    const { userId, role } = await loginUser(parsed.data.email, parsed.data.password);

    const accessToken = jwt.sign({ userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(200).json({ data: { accessToken } });
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS' } });
      return;
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: (e as Error).message } });
  }
};