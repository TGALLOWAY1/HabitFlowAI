import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestContext = {
  requestId: string;
  warnings: Set<string>;
};

const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function requestContextMiddleware(_req: Request, _res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  requestContextStore.run({ requestId, warnings: new Set<string>() }, () => {
    next();
  });
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

export function getRequestId(): string | undefined {
  return requestContextStore.getStore()?.requestId;
}

/**
 * Logs a warning at most once per request context.
 * Falls back to a normal warning if no request context is active.
 */
export function warnOncePerRequest(message: string): void {
  const context = requestContextStore.getStore();
  if (!context) {
    console.warn(message);
    return;
  }

  if (context.warnings.has(message)) {
    return;
  }

  context.warnings.add(message);
  console.warn(message);
}
