#!/usr/bin/env node
/**
 * Force-logout a user by deleting all their active sessions from the BFF store.
 * Their next request will be redirected to the login page.
 *
 * Usage:
 *   node scripts/admin/force-logout-user.mjs \
 *     --user <githubLogin> \
 *     [--stage DEV|STAGING|DEMO]
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';

const { values } = parseArgs({
  options: {
    stage: { type: 'string', short: 's', default: 'DEV' },
    user:  { type: 'string', short: 'u' },
  },
  strict: false,
});

if (!values.user) {
  console.error('Usage: force-logout-user.mjs --user <githubLogin> [--stage DEV|STAGING|DEMO]');
  process.exit(1);
}

const stage = parseStage(values.stage);
console.log(`\n🔒  Force-logout user "${values.user}"  [${stage}]\n`);

const { registryClient, bffClient, close } = await connect(stage);
try {
  const registry = registryClient.db();
  const user = await registry.collection('users').findOne({ githubLogin: values.user });
  if (!user) {
    console.error(`❌  User "${values.user}" not found. Run list-users.mjs to see available users.`);
    process.exit(1);
  }

  const userId = user._id.toString();
  const bffDb  = bffClient.db();

  // connect-mongo can store session.user as either a plain object or a JSON string
  const result = await bffDb.collection('sessions').deleteMany({
    $or: [
      { 'session.user.id':       userId },
      { 'session.user.githubId': user.githubId },
      { 'session.user.githubLogin': user.githubLogin },
    ],
  });

  if (result.deletedCount === 0) {
    console.log(`ℹ️   No active sessions found for "${values.user}" (already logged out?)`);
  } else {
    console.log(`✅  Deleted ${result.deletedCount} session(s) for ${values.user}`);
    console.log(`    The user will be prompted to log in on their next request.`);
  }
} finally {
  await close();
}
