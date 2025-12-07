// Session type declarations

import 'express-session';
import type { Session } from 'express-session';

export interface SessionUser {
  id: string;
  githubId: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
  createdAt: string;
  updatedAt: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    activeTenantId?: string;
  }
}

export function setActiveTenant(session: Session, tenantId: string): void {
  session.activeTenantId = tenantId;
}

export function getActiveTenant(session: Session): string | undefined {
  return session.activeTenantId;
}
