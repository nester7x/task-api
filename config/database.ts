import mongoose from 'mongoose';

export const connectDb = (): void => {
  mongoose
    .connect(
      `mongodb+srv://${process.env.DB_LOGIN}:${process.env.DB_PASSWORD}@backenddb.ptokbkl.mongodb.net/?appName=${process.env.APP_NAME}`
    )
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log(err));
};