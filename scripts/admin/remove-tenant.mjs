#!/usr/bin/env node
/**
 * Remove a tenant: drops its database and removes all registry entries.
 *
 * --complete  Also removes the associated user account and all their sessions
 *             (only meaningful for USER-type tenants; for ORG tenants it removes
 *             all role assignments but not the users themselves).
 *
 * Usage:
 *   node scripts/admin/remove-tenant.mjs \
 *     --tenant <tenantId> \
 *     [--complete] \
 *     [--stage DEV|STAGING|DEMO]
 *
 * Examples:
 *   node scripts/admin/remove-tenant.mjs --tenant user_abc123 --stage STAGING
 *   node scripts/admin/remove-tenant.mjs --tenant org_xyz789 --complete --stage DEV
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';
import { getTenantDbName } from './lib/tenant.mjs';
import readline from 'readline/promises';

const { values } = parseArgs({
  options: {
    stage:    { type: 'string',  short: 's', default: 'DEV' },
    tenant:   { type: 'string',  short: 't' },
    complete: { type: 'boolean',             default: false },
  },
  strict: false,
});

if (!values.tenant) {
  console.error('Usage: remove-tenant.mjs --tenant <tenantId> [--complete] [--stage DEV|STAGING|DEMO]');
  process.exit(1);
}

const stage = parseStage(values.stage);

// ─── confirmation prompt ────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const dbName = getTenantDbName(values.tenant);
console.log(`\n🗑️   Remove tenant: ${values.tenant}`);
console.log(`     Database:      ${dbName}`);
console.log(`     Complete:      ${values.complete ? 'YES (user + sessions deleted)' : 'no'}`);
console.log(`     Stage:         ${stage}\n`);
const answer = await rl.question('Type the tenantId to confirm: ');
rl.close();
if (answer.trim() !== values.tenant) {
  console.log('Aborted.');
  process.exit(0);
}

console.log();
const { registryClient, tenantClient, bffClient, close } = await connect(stage);
try {
  const registry = registryClient.db();

  const tenant = await registry.collection('tenants').findOne({ tenantId: values.tenant });
  if (!tenant) {
    console.error(`❌  Tenant "${values.tenant}" not found in registry.`);
    process.exit(1);
  }

  // 1. Drop tenant database
  try {
    await tenantClient.db(dbName).dropDatabase();
    console.log(`✅  Dropped database: ${dbName}`);
  } catch (err) {
    console.warn(`⚠️   Could not drop database ${dbName}: ${err.message}`);
  }

  // 2. Remove all role assignments for this tenant
  const rolesResult = await registry.collection('user_tenant_roles').deleteMany({
    tenantId: values.tenant,
  });
  console.log(`✅  Removed ${rolesResult.deletedCount} role assignment(s)`);

  // 3. Remove tenant record from registry
  await registry.collection('tenants').deleteOne({ tenantId: values.tenant });
  console.log(`✅  Removed tenant from registry`);

  if (values.complete) {
    if (tenant.tenantType === 'USER') {
      // For USER tenants: tenantId = user_<githubId>, delete the user account
      const githubId = values.tenant.replace(/^user_/, '');
      const user = await registry.collection('users').findOne({ githubId });
      if (user) {
        await registry.collection('users').deleteOne({ _id: user._id });
        console.log(`✅  Deleted user account: ${user.githubLogin} (${user._id})`);

        // Delete all BFF sessions for this user
        const bffDb = bffClient.db();
        // connect-mongo stores session data as a BSON object; user ID is nested inside
        const sessResult = await bffDb.collection('sessions').deleteMany({
          $or: [
            { 'session.user.id':      user._id.toString() },
            { 'session.user.githubId': user.githubId },
          ],
        });
        console.log(`✅  Deleted ${sessResult.deletedCount} session(s) for ${user.githubLogin}`);
      } else {
        console.log(`ℹ️   No user found with githubId "${githubId}" (already removed?)`);
      }
    } else {
      // For ORG tenants: just note that user accounts are preserved
      console.log(`ℹ️   ORG tenant — user accounts are not deleted (they may have personal tenants).`);
      console.log(`    Use remove-user-from-tenant.mjs individually if needed.`);
    }
  }

  console.log(`\n✅  Tenant "${values.tenant}" fully removed.`);
} finally {
  await close();
}
