import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { accountsRouter } from './routes/accounts';
import { authRouter } from './routes/auth';
import { followUpsRouter } from './routes/followUps';
import { meetingsRouter } from './routes/meetings';
import { usersRouter } from './routes/users';

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin.split(',') }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/users', usersRouter);
  api.use('/accounts', accountsRouter);
  api.use('/meetings', meetingsRouter);
  api.use('/follow-ups', followUpsRouter);
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
