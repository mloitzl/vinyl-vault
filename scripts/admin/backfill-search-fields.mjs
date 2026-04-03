#!/usr/bin/env node
/**
 * Backfill embedded release search fields on all existing record documents.
 *
 * New records receive these fields automatically at creation time. This script
 * populates them on records that were created before the denormalization was
 * introduced. Safe to re-run: uses $set so already-populated fields are
 * overwritten with the same values (idempotent).
 *
 * Usage (stage-based — same as all other admin scripts):
 *   node scripts/admin/backfill-search-fields.mjs [--stage DEV|STAGING|DEMO] [--dry-run]
 *
 * Or with explicit connection strings to keep credentials out of `ps`
 * (mirrors the backend .env variable names):
 *   export MONGODB_REGISTRY_URI="mongodb+srv://..."
 *   export MONGODB_URI_BASE="mongodb+srv://..."
 *   node scripts/admin/backfill-search-fields.mjs [--dry-run]
 *
 * MONGODB_REGISTRY_URI  – URI for vinylvault_registry (users, tenants, roles)
 * MONGODB_URI_BASE      – Base URI for tenant databases (no database name;
 *                         script appends vv_<hash> per tenant)
 * On Atlas both typically point to the same cluster.
 */

import { parseArgs } from 'node:util';
import { MongoClient } from 'mongodb';
import { connect, parseStage } from './lib/connect.mjs';
import { getTenantDbName } from './lib/tenant.mjs';

const { values } = parseArgs({
  options: {
    stage:     { type: 'string',  short: 's', default: 'DEV' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: false,
});

const DRY_RUN = values['dry-run'];

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Backfill one tenant database.
 * Returns { updated, skipped, total }.
 */
async function backfillTenant(tenantClient, dbName, dryRun) {
  const db = tenantClient.db(dbName);
  const records = db.collection('records');
  const releases = db.collection('releases');

  const total = await records.countDocuments({});
  if (total === 0) {
    return { updated: 0, skipped: 0, total: 0 };
  }

  let updated = 0;
  let skipped = 0;

  for await (const record of records.find({}, { projection: { _id: 1, releaseId: 1, releaseArtist: 1 } })) {
    // Skip if already populated (idempotency fast-path)
    if (record.releaseArtist !== undefined) {
      skipped++;
      continue;
    }

    const release = await releases.findOne(
      { _id: record.releaseId },
      { projection: { artist: 1, title: 1, year: 1, format: 1, genre: 1, style: 1, label: 1, country: 1 } }
    );

    if (!release) {
      console.warn(`    ⚠️  No release found for record ${record._id} (releaseId: ${record.releaseId})`);
      skipped++;
      continue;
    }

    const searchFields = {
      releaseArtist:  release.artist,
      releaseTitle:   release.title,
      releaseYear:    release.year,
      releaseFormat:  release.format,
      releaseGenre:   release.genre,
      releaseStyle:   release.style,
      releaseLabel:   release.label,
      releaseCountry: release.country,
    };

    if (!dryRun) {
      await records.updateOne({ _id: record._id }, { $set: searchFields });
    }

    updated++;
  }

  return { updated, skipped, total };
}

// ─── main ─────────────────────────────────────────────────────────────────────

// Support explicit URIs — use the same variable names as the backend .env
// so you can source the same file without renaming anything.
// MONGODB_REGISTRY_URI = registry database (vinylvault_registry)
// MONGODB_URI_BASE     = base URI for tenant databases (no db name)
const registryUri = process.env.MONGODB_REGISTRY_URI;
const tenantUri   = process.env.MONGODB_URI_BASE;

let registryClient;
let tenantClient;
let close;

if (registryUri && tenantUri) {
  registryClient = await new MongoClient(registryUri).connect();
  tenantClient   = await new MongoClient(tenantUri).connect();
  close = async () => Promise.allSettled([registryClient.close(), tenantClient.close()]);
} else {
  const stage = parseStage(values.stage);
  const conn  = await connect(stage);
  registryClient = conn.registryClient;
  tenantClient   = conn.tenantClient;
  close          = conn.close;
}

console.log(`\n🔄  Backfill embedded search fields${DRY_RUN ? '  [dry-run]' : ''}\n`);

try {
  const tenants = await registryClient
    .db()
    .collection('tenants')
    .find({}, { projection: { tenantId: 1, name: 1 } })
    .toArray();

  if (tenants.length === 0) {
    console.log('ℹ️   No tenants found.');
    process.exit(0);
  }

  let grandTotal = 0;
  let grandUpdated = 0;
  let grandSkipped = 0;

  for (const tenant of tenants) {
    const dbName = getTenantDbName(tenant.tenantId);
    process.stdout.write(`  📦  ${dbName}  (${tenant.name ?? tenant.tenantId})  `);

    const { updated, skipped, total } = await backfillTenant(tenantClient, dbName, DRY_RUN);
    grandTotal   += total;
    grandUpdated += updated;
    grandSkipped += skipped;

    if (total === 0) {
      console.log('(no records)');
    } else {
      console.log(`${updated} updated, ${skipped} already populated, ${total} total`);
    }
  }

  console.log(`\n${ DRY_RUN ? '🔍  Dry-run complete' : '✅  Done' } — ${grandUpdated} record(s) updated, ${grandSkipped} skipped, ${grandTotal} total across ${tenants.length} tenant(s)`);
} finally {
  await close();
}
