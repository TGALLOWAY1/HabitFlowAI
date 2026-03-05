/**
 * Request logging: logs method, path, requestId, status. Does not log request body or secrets.
 */

import type { Request, Response, NextFunction } from 'express';
import { getRequestId } from './requestContext';

export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = getRequestId() ?? 'no-request-id';
  (req as Request & { requestId?: string }).requestId = requestId;

  res.on('finish', () => {
    const status = res.statusCode;
    const method = req.method;
    const path = req.path;
    const logLine = `[${new Date().toISOString()}] ${requestId} ${method} ${path} ${status}`;
    if (status >= 500) {
      console.error(logLine);
    } else if (status >= 400) {
      console.warn(logLine);
    } else if (process.env.NODE_ENV === 'production') {
      console.log(logLine);
    }
  });

  next();
}
