import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { discoverLimit } from '../../middleware/rateLimits.js';
import { validate } from '../../middleware/validate.js';
import { DiscoverQuery, SwipeBody } from './discover.schemas.js';
import * as discover from './discover.service.js';

export const discoverRouter = Router();
discoverRouter.use(requireAuth);

discoverRouter.get('/', discoverLimit, validate({ query: DiscoverQuery }), async (req, res) => {
  res.json(await discover.discover(currentUserId(req), res.locals.query));
});

export const swipesRouter = Router();
swipesRouter.use(requireAuth);

swipesRouter.post('/', validate({ body: SwipeBody }), async (req, res) => {
  res.json(await discover.swipe(currentUserId(req), req.body.targetId, req.body.action));
});
