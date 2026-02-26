import mongoose, { Schema } from 'mongoose';

export interface IUser {
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required']
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
      enum: ['user', 'admin'],
      default: 'user'
    }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);