import express from 'express';
import apiRouter from './routes/index';

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.get('/', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/v1', apiRouter);

  return app;
};