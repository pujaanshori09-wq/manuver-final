import { Router } from 'express';
import multer from 'multer';
import { badRequest } from '../../lib/errors.js';
import { currentUserId, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  LocationBody,
  OnboardingBody,
  PhotoIdParams,
  PhotoOrderBody,
  ProfilePatchBody,
  PromptsBody,
  SportsBody,
} from './me.schemas.js';
import * as me from './me.service.js';

export const meRouter = Router();
meRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // First gate on the declared type; the service checks the real bytes too.
    if (me.ALLOWED_IMAGE_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('unsupported_image', 'Upload a JPEG, PNG, WebP or HEIC photo'));
  },
});

meRouter.get('/', async (req, res) => {
  res.json(await me.getMe(currentUserId(req)));
});

meRouter.patch('/profile', validate({ body: ProfilePatchBody }), async (req, res) => {
  res.json(await me.updateProfile(currentUserId(req), req.body));
});

meRouter.put('/sports', validate({ body: SportsBody }), async (req, res) => {
  res.json(await me.replaceSports(currentUserId(req), req.body.sports));
});

meRouter.put('/location', validate({ body: LocationBody }), async (req, res) => {
  await me.updateLocation(currentUserId(req), req.body.latitude, req.body.longitude);
  res.status(204).end();
});

meRouter.post('/onboarding', validate({ body: OnboardingBody }), async (req, res) => {
  res.json(await me.completeOnboarding(currentUserId(req), req.body));
});

meRouter.post('/photos', (req, res, next) => {
  upload.single('photo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(
        err.code === 'LIMIT_FILE_SIZE'
          ? badRequest('image_too_large', 'Photos can be at most 8 MB')
          : badRequest('upload_error', err.message),
      );
      return;
    }
    if (err) return next(err);
    if (!req.file) return next(badRequest('no_file', 'Attach a photo in the "photo" field'));
    me.addPhoto(currentUserId(req), req.file)
      .then((result) => res.status(201).json(result))
      .catch(next);
  });
});

meRouter.put('/photos/order', validate({ body: PhotoOrderBody }), async (req, res) => {
  res.json(await me.reorderPhotos(currentUserId(req), req.body.ids));
});

meRouter.delete('/photos/:id', validate({ params: PhotoIdParams }), async (req, res) => {
  res.json(await me.deletePhoto(currentUserId(req), String(req.params.id)));
});

meRouter.put('/prompts', validate({ body: PromptsBody }), async (req, res) => {
  res.json(await me.replacePrompts(currentUserId(req), req.body.prompts));
});

meRouter.delete('/', async (req, res) => {
  await me.deleteAccount(currentUserId(req));
  res.status(204).end();
});

export const promptsRouter = Router();
promptsRouter.get('/questions', requireAuth, async (_req, res) => {
  res.json(await me.listQuestions());
});
