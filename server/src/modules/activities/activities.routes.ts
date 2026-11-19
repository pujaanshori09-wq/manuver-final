import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { activityLimit } from '../../middleware/rateLimits.js';
import { validate } from '../../middleware/validate.js';
import { ActivityIdParams, CreateActivityBody, ListQuery, UpdateActivityBody, UserIdParams } from './activities.schemas.js';
import * as activities from './activities.service.js';

export const activitiesRouter = Router();
activitiesRouter.use(requireAuth);

activitiesRouter.post('/', activityLimit, validate({ body: CreateActivityBody }), async (req, res) => {
  res.status(201).json(await activities.create(currentUserId(req), req.body));
});

activitiesRouter.get('/', validate({ query: ListQuery }), async (req, res) => {
  res.json(await activities.listMine(currentUserId(req), res.locals.query));
});

activitiesRouter.get('/:id', validate({ params: ActivityIdParams }), async (req, res) => {
  res.json(await activities.get(currentUserId(req), req.params.id as string));
});

activitiesRouter.patch('/:id', validate({ params: ActivityIdParams, body: UpdateActivityBody }), async (req, res) => {
  res.json(await activities.update(currentUserId(req), req.params.id as string, req.body));
});

activitiesRouter.delete('/:id', validate({ params: ActivityIdParams }), async (req, res) => {
  await activities.remove(currentUserId(req), req.params.id as string);
  res.status(204).end();
});

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/:id', validate({ params: UserIdParams }), async (req, res) => {
  res.json(await activities.publicProfile(currentUserId(req), req.params.id as string));
});

usersRouter.get('/:id/activities', validate({ params: UserIdParams, query: ListQuery }), async (req, res) => {
  res.json(await activities.listForUser(currentUserId(req), req.params.id as string, res.locals.query));
});
