import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { meRouter, promptsRouter } from './modules/me/me.routes.js';
import { uploadRoot } from './lib/storage.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a tunnel/reverse proxy (ngrok, Render): trust the first hop for client IPs (rate limits).
  app.set('trust proxy', 1);

  // Photos are loaded by the app from another origin (Expo web, proxies): allow cross-origin reads.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // Native apps send no Origin header; browsers (Expo web) must be on the allow-list.
      origin: (origin, cb) => cb(null, !origin || env.CORS_ORIGINS.includes(origin)),
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (!isTest) app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  });

  // Uploaded photos. File names are random UUIDs, so they can be cached for a long time.
  app.use(
    '/uploads',
    express.static(uploadRoot, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }),
  );

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/me', meRouter);
  v1.use('/prompts', promptsRouter);
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
