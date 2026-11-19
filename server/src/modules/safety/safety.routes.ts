import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { reportLimit } from '../../middleware/rateLimits.js';
import { validate } from '../../middleware/validate.js';
import { BlockBody, ReportBody, UserIdParams } from './safety.schemas.js';
import * as safety from './safety.service.js';

export const blocksRouter = Router();
blocksRouter.use(requireAuth);

blocksRouter.get('/', async (req, res) => {
  res.json(await safety.listBlocked(currentUserId(req)));
});

blocksRouter.post('/', validate({ body: BlockBody }), async (req, res) => {
  await safety.block(currentUserId(req), req.body.userId);
  res.status(204).end();
});

blocksRouter.delete('/:userId', validate({ params: UserIdParams }), async (req, res) => {
  await safety.unblock(currentUserId(req), req.params.userId as string);
  res.status(204).end();
});

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.post('/', reportLimit, validate({ body: ReportBody }), async (req, res) => {
  res.status(201).json(await safety.report(currentUserId(req), req.body));
});
