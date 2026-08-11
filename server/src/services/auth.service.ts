import bcrypt from 'bcryptjs';
import User from '../db/models/user.model';

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export const registerUser = async (email: string, password: string): Promise<void> => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new EmailAlreadyExistsError();
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await User.create({ email, password: hashedPassword, role: 'admin', emailVerified: false });
};

export const loginUser = async (email: string, password: string): Promise<{ userId: string; role: 'admin' | 'guest' }> => {
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new InvalidCredentialsError();
  }

  return { userId: user._id.toString(), role: user.role };
};