#!/usr/bin/env node
/**
 * Add a user to a tenant with an optional role.
 *
 * Usage:
 *   node scripts/admin/add-user-to-tenant.mjs \
 *     --user <githubLogin> \
 *     --tenant <tenantId> \
 *     [--role ADMIN|MEMBER|VIEWER]  (default: MEMBER) \
 *     [--stage DEV|STAGING|DEMO]
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';

const VALID_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];

const { values } = parseArgs({
  options: {
    stage:  { type: 'string', short: 's', default: 'DEV' },
    user:   { type: 'string', short: 'u' },
    tenant: { type: 'string', short: 't' },
    role:   { type: 'string', short: 'r', default: 'MEMBER' },
  },
  strict: false,
});

if (!values.user || !values.tenant) {
  console.error('Usage: add-user-to-tenant.mjs --user <githubLogin> --tenant <tenantId> [--role ADMIN|MEMBER|VIEWER] [--stage DEV|STAGING|DEMO]');
  process.exit(1);
}

const role = values.role.toUpperCase();
if (!VALID_ROLES.includes(role)) {
  console.error(`Invalid role "${values.role}". Valid roles: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

const stage = parseStage(values.stage);
console.log(`\n➕  Adding user "${values.user}" to tenant "${values.tenant}" as ${role}  [${stage}]\n`);

const { registryClient, close } = await connect(stage);
try {
  const db = registryClient.db();

  const user = await db.collection('users').findOne({ githubLogin: values.user });
  if (!user) {
    console.error(`❌  User "${values.user}" not found. Run list-users.mjs to see available users.`);
    process.exit(1);
  }

  const tenant = await db.collection('tenants').findOne({ tenantId: values.tenant });
  if (!tenant) {
    console.error(`❌  Tenant "${values.tenant}" not found. Run list-tenants.mjs to see available tenants.`);
    process.exit(1);
  }

  const existing = await db.collection('user_tenant_roles').findOne({
    userId:   user._id,
    tenantId: values.tenant,
  });

  if (existing) {
    if (existing.role === role) {
      console.log(`ℹ️   ${values.user} already has role ${role} in ${values.tenant}. Nothing to do.`);
    } else {
      await db.collection('user_tenant_roles').updateOne(
        { _id: existing._id },
        { $set: { role, updatedAt: new Date() } }
      );
      console.log(`✅  Updated role: ${existing.role} → ${role}`);
    }
  } else {
    await db.collection('user_tenant_roles').insertOne({
      userId:    user._id,
      tenantId:  values.tenant,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`✅  Added ${values.user} (${user._id}) to ${values.tenant} as ${role}`);
  }
} finally {
  await close();
}
