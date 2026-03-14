#!/usr/bin/env node
/**
 * Remove a user from a tenant (revokes their role assignment).
 *
 * Usage:
 *   node scripts/admin/remove-user-from-tenant.mjs \
 *     --user <githubLogin> \
 *     --tenant <tenantId> \
 *     [--stage DEV|STAGING|DEMO]
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';

const { values } = parseArgs({
  options: {
    stage:  { type: 'string', short: 's', default: 'DEV' },
    user:   { type: 'string', short: 'u' },
    tenant: { type: 'string', short: 't' },
  },
  strict: false,
});

if (!values.user || !values.tenant) {
  console.error('Usage: remove-user-from-tenant.mjs --user <githubLogin> --tenant <tenantId> [--stage DEV|STAGING|DEMO]');
  process.exit(1);
}

const stage = parseStage(values.stage);
console.log(`\n➖  Removing user "${values.user}" from tenant "${values.tenant}"  [${stage}]\n`);

const { registryClient, close } = await connect(stage);
try {
  const db = registryClient.db();

  const user = await db.collection('users').findOne({ githubLogin: values.user });
  if (!user) {
    console.error(`❌  User "${values.user}" not found. Run list-users.mjs to see available users.`);
    process.exit(1);
  }

  const result = await db.collection('user_tenant_roles').deleteOne({
    userId:   user._id,
    tenantId: values.tenant,
  });

  if (result.deletedCount === 0) {
    console.log(`ℹ️   ${values.user} had no role in ${values.tenant}. Nothing removed.`);
  } else {
    console.log(`✅  Removed ${values.user} from ${values.tenant}`);
    console.log(`\n⚠️   Note: the user's active session still contains this tenant in availableTenants.`);
    console.log(`    Run force-logout-user.mjs --user ${values.user} to clear it immediately.`);
  }
} finally {
  await close();
}
