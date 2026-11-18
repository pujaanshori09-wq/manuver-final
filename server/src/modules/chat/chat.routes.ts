import { Router } from 'express';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { MatchIdParams, MessageIdParams, RespondBody, SendMessageBody } from './chat.schemas.js';
import * as chat from './chat.service.js';

export const matchesRouter = Router();
matchesRouter.use(requireAuth);

matchesRouter.get('/', async (req, res) => {
  res.json(await chat.listMatches(currentUserId(req)));
});

matchesRouter.get('/:id/messages', validate({ params: MatchIdParams }), async (req, res) => {
  res.json(await chat.listMessages(currentUserId(req), req.params.id as string));
});

matchesRouter.post('/:id/messages', validate({ params: MatchIdParams, body: SendMessageBody }), async (req, res) => {
  res.status(201).json(await chat.sendMessage(currentUserId(req), req.params.id as string, req.body));
});

export const messagesRouter = Router();
messagesRouter.use(requireAuth);

messagesRouter.post('/:id/respond', validate({ params: MessageIdParams, body: RespondBody }), async (req, res) => {
  res.json(await chat.respondToInvite(currentUserId(req), req.params.id as string, req.body.status));
});
