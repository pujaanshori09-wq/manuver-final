import type { RequestHandler } from 'express';
import type { z } from 'zod';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

/**
 * Validates and replaces req.body / req.query / req.params with the parsed (typed, trimmed)
 * values. A ZodError is turned into a 400 by the error handler.
 */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
    // Express 5 makes req.query a getter; store the parsed copy on res.locals instead.
    if (schemas.query) _res.locals.query = schemas.query.parse(req.query);
    next();
  };
