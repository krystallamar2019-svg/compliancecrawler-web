import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND' });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = res.locals.requestId as string | undefined;

  logger.error({
    err: error,
    requestId,
    method: req.method,
    path: req.path,
  }, 'Unhandled request error');

  if (res.headersSent) return;
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    ...(requestId ? { requestId } : {}),
  });
};
