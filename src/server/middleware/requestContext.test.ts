import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requestContextMiddleware, warnOncePerRequest } from './requestContext';

describe('requestContext warning helper', () => {
  it('logs once per request context', () => {
    const warning = 'LEGACY_DAYLOG_READS enabled';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    requestContextMiddleware({} as Request, {} as Response, () => {
      warnOncePerRequest(warning);
      warnOncePerRequest(warning);
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(warning);

    warnSpy.mockRestore();
  });

  it('falls back to normal logging when no request context is active', () => {
    const warning = 'LEGACY_DAYLOG_READS enabled';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnOncePerRequest(warning);
    warnOncePerRequest(warning);

    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});
