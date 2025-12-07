// Authorization utilities for tenant-scoped operations

import { GraphQLError } from 'graphql';
import type { GraphQLContext } from '../types/context.js';

/**
 * Check if context contains required role(s).
 * Throws GraphQLError if user doesn't have required role.
 */
export function requireRole(context: GraphQLContext, allowedRoles: string[]): void {
  if (!context.tenantRole || !allowedRoles.includes(context.tenantRole)) {
    throw new GraphQLError(
      `User role ${
        context.tenantRole ?? 'UNKNOWN'
      } is not authorized. Required: ${allowedRoles.join(', ')}`,
      { extensions: { code: 'FORBIDDEN' } }
    );
  }
}

/**
 * Check if user has ADMIN role.
 */
export function isAdmin(context: GraphQLContext): boolean {
  return context.tenantRole === 'ADMIN';
}

/**
 * Check if user has ADMIN or MEMBER role.
 */
export function isMember(context: GraphQLContext): boolean {
  return context.tenantRole === 'ADMIN' || context.tenantRole === 'MEMBER';
}

/**
 * Require ADMIN role, throw if not authorized.
 */
export function requireAdmin(context: GraphQLContext): void {
  if (!isAdmin(context)) {
    throw new GraphQLError('Admin role required for this operation', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Require MEMBER or ADMIN role, throw if not authorized.
 */
export function requireMember(context: GraphQLContext): void {
  if (!isMember(context)) {
    throw new GraphQLError('Member or Admin role required for this operation', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

/**
 * Check if user can write data (MEMBER or ADMIN role).
 */
export function canWrite(context: GraphQLContext): boolean {
  return isMember(context);
}

/**
 * Check if user can read data (any authenticated user).
 * All roles (ADMIN, MEMBER, VIEWER) can read.
 */
export function canRead(context: GraphQLContext): boolean {
  return Boolean(context.tenantRole);
}
