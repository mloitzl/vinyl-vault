// JWT validation for Backend
// TODO: Implement JWT verification

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface JwtPayload {
  sub: string; // User ID
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  githubLogin?: string;
  iat?: number;
  exp?: number;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}
