// Cookie utilities for onboarding OAuth flow
// Manages SameSite=lax cookie for organization setup to persist session through GitHub OAuth

import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Cookie options for onboarding cookie (SameSite=lax)
 * Restricted to /auth/setup path, short-lived, used only for OAuth round-trip
 */
function getOnboardingCookieOptions() {
  return {
    path: '/auth/setup',
    sameSite: 'lax' as const,
    secure: config.isProduction,
    httpOnly: true,
    maxAge: config.session.onboardingMaxAge,
  };
}

/**
 * Set onboarding cookie with session ID
 * Called after successful OAuth to carry session through setup flow
 */
export function setOnboardingCookie(res: Response, sessionId: string): void {
  // Produce a signed cookie value compatible with express-session / cookie-parser format:
  // value format: 's:' + sessionId + '.' + HMAC-SHA256(sessionId, secret) base64 (no padding)
  const signature = crypto
    .createHmac('sha256', config.session.secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  const signedValue = `s:${sessionId}.${signature}`;
  res.cookie(config.session.onboardingCookieName, signedValue, getOnboardingCookieOptions());
}

/**
 * Clear onboarding cookie (expire immediately)
 * Called after setup completes or if onboarding is not needed
 */
export function clearOnboardingCookie(res: Response): void {
  res.clearCookie(config.session.onboardingCookieName, {
    path: '/auth/setup',
    sameSite: 'lax' as const,
    secure: config.isProduction,
    httpOnly: true,
  });
}

/**
 * Get onboarding cookie value from request
 * Returns session ID if present, undefined otherwise
 */
export function getOnboardingCookie(req: Request): string | undefined {
  return req.cookies?.[config.session.onboardingCookieName];
}
