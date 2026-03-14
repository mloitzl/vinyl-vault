/**
 * Tenant database name derivation — mirrors packages/backend/src/db/connection.ts.
 *
 * MongoDB has a 38-byte limit for database names, so every tenant's DB is named
 * vv_<12-char-SHA256-hex> derived from the tenantId string.
 */

import { createHash } from 'crypto';

export function getTenantDbName(tenantId) {
  const hash = createHash('sha256').update(tenantId).digest('hex').substring(0, 12);
  return `vv_${hash}`;
}

export function formatTenantId(type, identifier) {
  // type: 'user' | 'org',  identifier: githubId or orgId
  return `${type}_${identifier}`;
}
