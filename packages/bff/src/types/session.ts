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

/**
 * Available tenant for a user (includes both personal and org tenants)
 */
export interface AvailableTenant {
  tenantId: string;
  tenantType: 'USER' | 'ORGANIZATION';
  name: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    activeTenantId?: string;
    availableTenants?: AvailableTenant[];
  }
}

export function setActiveTenant(session: Session, tenantId: string): void {
  (session as Session & { activeTenantId?: string }).activeTenantId = tenantId;
}

export function getActiveTenant(session: Session): string | undefined {
  return (session as Session & { activeTenantId?: string }).activeTenantId;
}

export function setAvailableTenants(session: Session, tenants: AvailableTenant[]): void {
  (session as Session & { availableTenants?: AvailableTenant[] }).availableTenants = tenants;
}

export function getAvailableTenants(session: Session): AvailableTenant[] {
  return (session as Session & { availableTenants?: AvailableTenant[] }).availableTenants || [];
}
