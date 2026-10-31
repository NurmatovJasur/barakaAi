import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { allowedOrigins, env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRouter } from './routes/index';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('json replacer', (_k: string, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: process.env.NODE_ENV === 'test' ? 100_000 : env.API_RATE_LIMIT,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMITED', message: 'Слишком много запросов, попробуйте позже' } },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use('/api', apiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
