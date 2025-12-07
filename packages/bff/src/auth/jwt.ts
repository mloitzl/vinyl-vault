// JWT utilities for BFF to Backend communication

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export interface JwtPayload {
  sub: string; // User ID
  username: string;
  avatarUrl?: string;
  tenantId: string;
  tenantRole: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  githubLogin?: string;
  iat?: number;
  exp?: number;
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}
