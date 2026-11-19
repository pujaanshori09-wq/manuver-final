import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { postLimit } from '../../middleware/rateLimits.js';
import { validate } from '../../middleware/validate.js';
import { CreateEventBody, CreateSessionBody, CreateSosBody, IdParams, SportQuery } from './explore.schemas.js';
import * as explore from './explore.service.js';

const id = (req: { params: Record<string, unknown> }) => req.params.id as string;

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);
sessionsRouter.get('/', validate({ query: SportQuery }), async (req, res) => {
  res.json(await explore.listSessions(currentUserId(req), res.locals.query.sport));
});
sessionsRouter.post('/', postLimit, validate({ body: CreateSessionBody }), async (req, res) => {
  res.status(201).json(await explore.createSession(currentUserId(req), req.body));
});
sessionsRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await explore.cancelSession(currentUserId(req), id(req));
  res.status(204).end();
});
sessionsRouter.post('/:id/join', validate({ params: IdParams }), async (req, res) => {
  await explore.joinSession(currentUserId(req), id(req));
  res.status(204).end();
});
sessionsRouter.delete('/:id/join', validate({ params: IdParams }), async (req, res) => {
  await explore.leaveSession(currentUserId(req), id(req));
  res.status(204).end();
});

export const sosRouter = Router();
sosRouter.use(requireAuth);
sosRouter.get('/', async (req, res) => {
  res.json(await explore.listSos(currentUserId(req)));
});
sosRouter.post('/', postLimit, validate({ body: CreateSosBody }), async (req, res) => {
  res.status(201).json(await explore.createSos(currentUserId(req), req.body));
});
sosRouter.delete('/:id', validate({ params: IdParams }), async (req, res) => {
  await explore.cancelSos(currentUserId(req), id(req));
  res.status(204).end();
});
sosRouter.post('/:id/claim', validate({ params: IdParams }), async (req, res) => {
  res.json(await explore.claimSos(currentUserId(req), id(req)));
});

export const eventsRouter = Router();
eventsRouter.use(requireAuth);
eventsRouter.get('/', async (req, res) => {
  res.json(await explore.listEvents(currentUserId(req)));
});
eventsRouter.post('/', postLimit, validate({ body: CreateEventBody }), async (req, res) => {
  res.status(201).json(await explore.createEvent(currentUserId(req), req.body));
});
eventsRouter.get('/:id', validate({ params: IdParams }), async (req, res) => {
  res.json(await explore.getEvent(currentUserId(req), id(req)));
});
eventsRouter.post('/:id/register', validate({ params: IdParams }), async (req, res) => {
  res.json(await explore.registerForEvent(currentUserId(req), id(req)));
});
eventsRouter.delete('/:id/register', validate({ params: IdParams }), async (req, res) => {
  res.json(await explore.unregisterFromEvent(currentUserId(req), id(req)));
});
