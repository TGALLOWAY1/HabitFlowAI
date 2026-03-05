/**
 * Session cookie: name, options, and helper to set/clear.
 */

import type { Response } from 'express';

export const SESSION_COOKIE_NAME = 'hf_session';
/** 14 days in milliseconds */
export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export function getSessionCookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'lax' | 'strict' | 'none'; maxAge: number; path: string } {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
}
