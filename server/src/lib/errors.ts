/**
 * Errors the API returns on purpose. Anything else becomes a generic 500.
 * Response body: { error: { code, message, details? } }
 * `code` is stable and machine-readable (the app maps it to translated text).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message = 'Authentication required') =>
  new AppError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'Not allowed') => new AppError(403, code, message);
export const notFound = (code = 'not_found', message = 'Not found') => new AppError(404, code, message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
