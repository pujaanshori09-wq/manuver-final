import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import express, { Router } from 'express';
import { SlugParams } from '../activities/activities.schemas.js';
import { getPublic } from '../activities/activities.service.js';
import { activityPage, notAvailablePage, pickLang } from './share.page.js';

/** Public activity links: /a/<code>. No login; served as plain HTML. */
export const shareRouter = Router();

// Leaflet is served from here, not a third-party CDN.
const leafletDir = path.dirname(createRequire(import.meta.url).resolve('leaflet/dist/leaflet.js'));
shareRouter.use('/_', express.static(leafletDir, { maxAge: '30d', index: false, dotfiles: 'deny' }));

shareRouter.get('/:slug', async (req, res) => {
  const lang = pickLang(req.acceptsLanguages('id', 'en'));
  // Personal pages: never indexed, never cached (switching the link off must work at once).
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.type('html');

  const parsed = SlugParams.safeParse(req.params);
  const activity = parsed.success ? await getPublic(parsed.data.slug) : null;
  if (!activity) {
    res.status(404).send(notAvailablePage(lang));
    return;
  }

  const nonce = randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'none'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://tile.openstreetmap.org",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  res.send(activityPage(activity, lang, nonce));
});
