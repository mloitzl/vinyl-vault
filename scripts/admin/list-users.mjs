#!/usr/bin/env node
/**
 * List all registered users.
 *
 * Usage:
 *   node scripts/admin/list-users.mjs [--stage DEV|STAGING|DEMO]
 */

import { parseArgs } from 'node:util';
import { connect, parseStage } from './lib/connect.mjs';

const { values } = parseArgs({
  options: {
    stage: { type: 'string', short: 's', default: 'DEV' },
  },
  strict: false,
});

const stage = parseStage(values.stage);
console.log(`\n📋  Listing users  [${stage}]\n`);

const { registryClient, close } = await connect(stage);
try {
  const db = registryClient.db();
  const users = await db.collection('users').find({}).sort({ createdAt: -1 }).toArray();

  if (users.length === 0) {
    console.log('  (no users found)');
  } else {
    const rows = users.map((u) => ({
      id:          u._id.toString(),
      githubLogin: u.githubLogin,
      displayName: u.displayName ?? '',
      githubId:    u.githubId,
      email:       u.email ?? '',
      createdAt:   u.createdAt?.toISOString?.() ?? '',
    }));
    console.table(rows);
    console.log(`\nTotal: ${users.length} user(s)`);
  }
} finally {
  await close();
}
