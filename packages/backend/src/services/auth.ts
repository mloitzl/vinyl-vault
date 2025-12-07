// JWT validation for Backend
// TODO: Implement JWT verification

import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

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

export interface TenantContext {
  userId: string;
  username: string;
  avatarUrl?: string;
  tenantId: string;
  tenantRole: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  githubLogin?: string;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    return null;
  }
}

export function extractTenantContext(token?: string): TenantContext | null {
  if (!token) return null;
  const payload = verifyJwt(token);
  if (!payload) return null;

  const { sub, username, avatarUrl, tenantId, tenantRole, githubLogin } = payload;
  return {
    userId: sub,
    username,
    avatarUrl,
    tenantId,
    tenantRole,
    githubLogin,
  };
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}
