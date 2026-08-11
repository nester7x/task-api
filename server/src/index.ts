import { env } from './config/env'; // Must be first — validates env; exits if invalid
import { createApp } from './app';
import { connectDb } from './db/connect';
import { connectRedis } from './db/redis';

const app = createApp();

Promise.all([connectDb(), connectRedis()])
  .then(() => {
    app.listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`));
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });