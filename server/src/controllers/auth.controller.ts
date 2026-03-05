import type { Request, Response } from 'express';
import User from '../db/models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ username, email, password: hashedPassword });

    res.status(201).json({ data: { _id: user.id, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = jwt.sign(
      { user: { username: user.username, email: user.email, id: user.id } },
      process.env.JWT_ACCESS_SECRET as string,
      { expiresIn: '15m' }
    );

    res.status(200).json({ data: { accessToken } });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
};