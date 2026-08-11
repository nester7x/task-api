import mongoose, { Schema } from 'mongoose';

export interface IUser {
  username?: string;
  email: string;
  password: string;
  role: 'admin' | 'guest';
  emailVerified: boolean;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true
    },
    password: {
      type: String,
      required: [true, 'Password is required']
    },
    role: {
      type: String,
      enum: ['admin', 'guest'],
      default: 'admin'
    },
    emailVerified: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);