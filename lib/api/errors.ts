import type { TKey, TParams } from '@/lib/i18n';
import { ApiError } from './client';

type Translate = (key: TKey, params?: TParams) => string;

// Stable server error codes → translated messages. Anything unknown falls back to the
// server's English message, which is still readable.
const MESSAGES: Partial<Record<string, TKey>> = {
  network_error: 'apiErrors.network',
  api_unreachable: 'apiErrors.network',
  rate_limited: 'apiErrors.rateLimited',
  invalid_credentials: 'apiErrors.invalidCredentials',
  email_taken: 'apiErrors.emailTaken',
  invalid_reset_token: 'apiErrors.invalidResetToken',
  google_disabled: 'apiErrors.googleDisabled',
  unsupported_image: 'apiErrors.unsupportedImage',
  image_too_large: 'apiErrors.imageTooLarge',
  too_many_photos: 'apiErrors.tooManyPhotos',
  invalid_age_range: 'apiErrors.invalidAgeRange',
  internal_error: 'apiErrors.server',
  cancelled: 'apiErrors.googleCancelled',
  google_failed: 'apiErrors.googleFailed',
  invalid_google_token: 'apiErrors.googleFailed',
  google_email_unverified: 'apiErrors.googleFailed',
  oauth_expired: 'apiErrors.invalidOauthCode',
  origin_not_allowed: 'apiErrors.googleFailed',
  invalid_oauth_code: 'apiErrors.invalidOauthCode',
};

/** A user-facing message for any error thrown by the API client. */
export function apiErrorMessage(e: unknown, tr: Translate): string {
  if (e instanceof ApiError) {
    const key = MESSAGES[e.code];
    if (key) return tr(key);
    if (e.code === 'validation_error' && e.details?.[0]) return e.details[0].message;
    return e.message;
  }
  return tr('apiErrors.unknown');
}

export const isApiError = (e: unknown, code?: string): e is ApiError =>
  e instanceof ApiError && (code === undefined || e.code === code);
