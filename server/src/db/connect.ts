import mongoose from 'mongoose';

export const connectDb = async (): Promise<void> => {
  // const uri = process.env.MONGODB_URI;
  const uri = `mongodb+srv://${process.env.DB_LOGIN}:${process.env.DB_PASSWORD}@backenddb.ptokbkl.mongodb.net/?appName=${process.env.APP_NAME}`;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');
};
