#!/usr/bin/env node
/**
 * Migrate all Vinyl Vault data from one MongoDB cluster to another.
 *
 * Discovers and copies:
 *   - vinylvault_registry  (users, tenants, roles, …)
 *   - vv_*                 (one database per tenant)
 *   - vinylvault_bff       (sessions — skippable with --skip-bff)
 *
 * Each collection is wiped on the destination before copying so the
 * script is safe to re-run.  Indexes are not copied; Atlas Search
 * indexes must be created separately in the Atlas UI / CLI.
 *
 * Usage:
 *   node scripts/admin/migrate-cluster.mjs \
 *     --src  <source-mongodb-uri> \
 *     --dst  <destination-mongodb-uri> \
 *     [--batch-size 1000] \
 *     [--skip-bff] \
 *     [--dry-run] \
 *     [-y]
 *
 * Examples:
 *   # Atlas → Atlas (set env vars to keep credentials out of `ps`)
 *   export VV_SRC_URI="mongodb+srv://user:pass@source.mongodb.net"
 *   export VV_DST_URI="mongodb+srv://user:pass@dest.mongodb.net"
 *   node scripts/admin/migrate-cluster.mjs --dry-run
 *   node scripts/admin/migrate-cluster.mjs -y
 */

import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import readline from 'readline/promises';
import { getTenantDbName } from './lib/tenant.mjs';

const REGISTRY_DB = 'vinylvault_registry';
const BFF_DB = 'vinylvault_bff';

// ─── CLI args ─────────────────────────────────────────────────────────────────
// --src / --dst can be omitted when VV_SRC_URI / VV_DST_URI are set in the
// environment, which keeps connection strings out of `ps` output.

const { values } = parseArgs({
  options: {
    src:           { type: 'string' },
    dst:           { type: 'string' },
    'batch-size':  { type: 'string',  default: '1000' },
    'skip-bff':    { type: 'boolean', default: false },
    'dry-run':     { type: 'boolean', default: false },
    yes:           { type: 'boolean', short: 'y', default: false },
  },
  strict: false,
});

const srcUri = values.src ?? process.env.VV_SRC_URI;
const dstUri = values.dst ?? process.env.VV_DST_URI;

if (!srcUri || !dstUri) {
  console.error(
    'Usage: migrate-cluster.mjs --src <uri> --dst <uri> ' +
    '[--batch-size N] [--skip-bff] [--dry-run] [-y]\n' +
    'Alternatively set VV_SRC_URI and VV_DST_URI environment variables.'
  );
  process.exit(1);
}

const BATCH_SIZE = Math.max(1, parseInt(values['batch-size'], 10) || 1000);
const DRY_RUN   = values['dry-run'];
const SKIP_BFF  = values['skip-bff'];

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Derive the full list of databases to migrate from the registry.
 * This avoids `listDatabases` which requires admin privileges on Atlas.
 */
async function listMigratableDbs(srcClient) {
  const tenants = await srcClient
    .db(REGISTRY_DB)
    .collection('tenants')
    .find({}, { projection: { tenantId: 1 } })
    .toArray();

  const tenantDbs = tenants.map((t) => getTenantDbName(t.tenantId)).sort();
  return [
    REGISTRY_DB,
    ...tenantDbs,
    ...(SKIP_BFF ? [] : [BFF_DB]),
  ];
}

async function copyCollection(srcDb, dstDb, collName) {
  const srcColl = srcDb.collection(collName);
  const total   = await srcColl.countDocuments();

  if (total === 0) {
    console.log(`    ${collName}: (empty)`);
    return { copied: 0, total: 0 };
  }

  if (DRY_RUN) {
    console.log(`    ${collName}: ${total.toLocaleString()} document(s)  [dry-run]`);
    return { copied: 0, total };
  }

  const dstColl = dstDb.collection(collName);
  await dstColl.deleteMany({});

  let copied = 0;
  let batch  = [];

  for await (const doc of srcColl.find({})) {
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await dstColl.insertMany(batch, { ordered: false });
      copied += batch.length;
      process.stdout.write(`\r    ${collName}: ${copied.toLocaleString()}/${total.toLocaleString()}`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await dstColl.insertMany(batch, { ordered: false });
    copied += batch.length;
  }

  process.stdout.write(`\r    ${collName}: ${copied.toLocaleString()}/${total.toLocaleString()} ✅\n`);
  return { copied, total };
}

async function migrateDatabase(srcClient, dstClient, dbName) {
  console.log(`\n  📦  ${dbName}`);
  const srcDb       = srcClient.db(dbName);
  const dstDb       = dstClient.db(dbName);
  const collections = await srcDb.listCollections().toArray();

  if (collections.length === 0) {
    console.log('    (no collections)');
    return;
  }

  let totalDocs  = 0;
  let copiedDocs = 0;

  for (const { name } of collections) {
    const { copied, total } = await copyCollection(srcDb, dstDb, name);
    totalDocs  += total;
    copiedDocs += copied;
  }

  const docCount = DRY_RUN ? totalDocs : copiedDocs;
  console.log(`  → ${collections.length} collection(s), ${docCount.toLocaleString()} document(s)`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

const srcClient = new MongoClient(srcUri);
const dstClient = new MongoClient(dstUri);

try {
  console.log('\n🔌  Connecting to source and destination clusters...');
  await Promise.all([srcClient.connect(), dstClient.connect()]);
  console.log('✅  Connected\n');

  const dbs = await listMigratableDbs(srcClient);

  if (dbs.length === 0) {
    console.log('ℹ️   No Vinyl Vault databases found on the source cluster.');
    process.exit(0);
  }

  console.log(`Found ${dbs.length} database(s) to migrate:`);
  for (const db of dbs) console.log(`  • ${db}`);

  if (!values.yes && !DRY_RUN) {
    const rl     = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      '\n⚠️   Collections on the destination will be OVERWRITTEN. Proceed? [y/N] '
    );
    rl.close();
    if (!['y', 'yes'].includes(answer.trim().toLowerCase())) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  console.log(
    DRY_RUN
      ? '\n🔍  Dry-run — nothing will be written\n'
      : '\n🚀  Starting migration...\n'
  );

  for (const dbName of dbs) {
    await migrateDatabase(srcClient, dstClient, dbName);
  }

  console.log(DRY_RUN ? '\n✅  Dry-run complete.' : '\n✅  Migration complete.');
} finally {
  await Promise.allSettled([srcClient.close(), dstClient.close()]);
}
