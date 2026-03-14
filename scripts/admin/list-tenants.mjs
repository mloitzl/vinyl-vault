#!/usr/bin/env node
/**
 * List all tenants with their member counts.
 *
 * Usage:
 *   node scripts/admin/list-tenants.mjs [--stage DEV|STAGING|DEMO]
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
console.log(`\n🏠  Listing tenants  [${stage}]\n`);

const { registryClient, close } = await connect(stage);
try {
  const db = registryClient.db();
  const [tenants, roles] = await Promise.all([
    db.collection('tenants').find({}).sort({ createdAt: -1 }).toArray(),
    db.collection('user_tenant_roles').find({}).toArray(),
  ]);

  if (tenants.length === 0) {
    console.log('  (no tenants found)');
  } else {
    const rows = tenants.map((t) => {
      const members = roles.filter((r) => r.tenantId === t.tenantId);
      return {
        id:          t._id.toString(),
        tenantId:    t.tenantId,
        type:        t.tenantType,
        name:        t.name,
        dbName:      getTenantDbName(t.tenantId),
        members:     members.length,
        createdAt:   t.createdAt?.toISOString?.() ?? '',
      };
    });
    console.table(rows);
    console.log(`\nTotal: ${tenants.length} tenant(s)`);
  }
} finally {
  await close();
}
