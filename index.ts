import express from 'express';
import dotenv from 'dotenv';
import productRoute from './routes/product.route';
import userRoute from './routes/user.route';
import { connectDb } from './config/database';

dotenv.config();

const app = express();

app.use(express.json());

connectDb();

app.use('/api/products', productRoute);
app.use('/api/users', userRoute);

app.listen(process.env.PORT, () =>
  console.log('Server started on port', process.env.PORT)
);