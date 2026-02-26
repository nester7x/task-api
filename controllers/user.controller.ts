import type { Request, Response } from 'express';
import User from '../models/user.model';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    const availableUser = await User.findOne({ email });
    if (availableUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ username, email, password: hashedPassword });

    if (user) {
      res.status(201).json({ _id: user.id, email: user.email });
    }
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
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
    if (user && (await bcrypt.compare(password, user.password))) {
      const accessToken = jwt.sign(
        { user: { username: user.username, email: user.email, id: user.id } },
        process.env.JWT_SECRET as string,
        { expiresIn: '60m' }
      );

      res.status(200).json({ accessToken });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const getUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.status(200).json({ user });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (id !== user.id) {
      res.status(403).json({ error: 'Unauthorized to update this user' });
      return;
    }

    await User.findByIdAndUpdate(id, req.body);
    const updatedUser = await User.findById(id);
    res.status(200).json({ user: updatedUser });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message });
  }
};