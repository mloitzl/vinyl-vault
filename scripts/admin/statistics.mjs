#!/usr/bin/env node
/**
 * Print collection statistics across the whole platform.
 *
 * Covers:
 *   - Users & tenants in the registry
 *   - Role assignments (breakdown by role)
 *   - Per-tenant: record count, unique release count, unique artists
 *   - Platform-wide totals
 *   - Active sessions
 *
 * Usage:
 *   node scripts/admin/statistics.mjs [--stage DEV|STAGING|DEMO]
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';
import { getTenantDbName } from './lib/tenant.mjs';

const { values } = parseArgs({
  options: {
    stage: { type: 'string', short: 's', default: 'DEV' },
  },
  strict: false,
});

const stage = parseStage(values.stage);
console.log(`\n📊  Platform Statistics  [${stage}]\n`);

const { registryClient, tenantClient, bffClient, close } = await connect(stage);
try {
  const registry = registryClient.db();

  // ── Registry ────────────────────────────────────────────────────────────
  const [userCount, tenants, roles] = await Promise.all([
    registry.collection('users').countDocuments(),
    registry.collection('tenants').find({}).toArray(),
    registry.collection('user_tenant_roles').find({}).toArray(),
  ]);

  const rolesByType = roles.reduce((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});

  const userTenants = tenants.filter((t) => t.tenantType === 'USER');
  const orgTenants  = tenants.filter((t) => t.tenantType === 'ORGANIZATION');

  console.log('── Registry ────────────────────────────────────');
  console.log(`  Users:                ${userCount}`);
  console.log(`  Tenants (total):      ${tenants.length}`);
  console.log(`    USER tenants:       ${userTenants.length}`);
  console.log(`    ORG  tenants:       ${orgTenants.length}`);
  console.log(`  Role assignments:     ${roles.length}`);
  for (const [role, count] of Object.entries(rolesByType)) {
    console.log(`    ${role.padEnd(8)}            ${count}`);
  }

  // ── Active sessions ──────────────────────────────────────────────────────
  const bffDb = bffClient.db();
  const activeSessions = await bffDb.collection('sessions').countDocuments({
    expires: { $gt: new Date() },
  });
  console.log(`\n── Sessions ────────────────────────────────────`);
  console.log(`  Active sessions:      ${activeSessions}`);

  // ── Per-tenant stats ─────────────────────────────────────────────────────
  console.log(`\n── Tenant Data ─────────────────────────────────`);

  let totalRecords  = 0;
  let totalReleases = 0;
  const tenantRows  = [];

  for (const tenant of tenants) {
    const dbName = getTenantDbName(tenant.tenantId);
    try {
      const tdb = tenantClient.db(dbName);
      const [recordCount, releaseCount] = await Promise.all([
        tdb.collection('records').countDocuments(),
        tdb.collection('releases').countDocuments(),
      ]);

      // Count unique artists via distinct
      const artists = await tdb.collection('releases').distinct('artist');

      totalRecords  += recordCount;
      totalReleases += releaseCount;

      tenantRows.push({
        tenantId: tenant.tenantId,
        name:     tenant.name,
        type:     tenant.tenantType,
        records:  recordCount,
        releases: releaseCount,
        artists:  artists.length,
      });
    } catch {
      tenantRows.push({
        tenantId: tenant.tenantId,
        name:     tenant.name,
        type:     tenant.tenantType,
        records:  'ERR',
        releases: 'ERR',
        artists:  'ERR',
      });
    }
  }

  if (tenantRows.length > 0) {
    console.table(tenantRows);
  } else {
    console.log('  (no tenants)');
  }

  console.log('── Totals ──────────────────────────────────────');
  console.log(`  Records  (all tenants): ${totalRecords}`);
  console.log(`  Releases (all tenants): ${totalReleases}`);
  console.log();
} finally {
  await close();
}
