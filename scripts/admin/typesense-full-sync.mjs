#!/usr/bin/env node
/**
 * Wipe and fully re-index all tenant records in Typesense from MongoDB.
 *
 * Use this for disaster recovery or after a Typesense collection schema change.
 * The sync worker's change stream will resume normally after this script finishes.
 *
 * Usage (stage-based):
 *   node scripts/admin/typesense-full-sync.mjs [--stage DEV|STAGING|DEMO] [--dry-run]
 *
 * Or with explicit connection strings (keeps credentials out of `ps`):
 *   export MONGODB_REGISTRY_URI="mongodb+srv://..."
 *   export MONGODB_URI_BASE="mongodb+srv://..."
 *   export TYPESENSE_HOST="xxx.typesense.net"
 *   export TYPESENSE_PORT="443"
 *   export TYPESENSE_PROTOCOL="https"
 *   export TYPESENSE_API_KEY="..."
 *   node scripts/admin/typesense-full-sync.mjs [--dry-run]
 */

import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { MongoClient } from 'mongodb';
import Typesense from 'typesense';
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
const BATCH_SIZE = 500;
const COLLECTION_NAME = 'records';

// ─── Typesense client ─────────────────────────────────────────────────────────

function buildTypesenseClient() {
  const host     = process.env.TYPESENSE_HOST     ?? 'localhost';
  const port     = parseInt(process.env.TYPESENSE_PORT ?? '8108', 10);
  const protocol = process.env.TYPESENSE_PROTOCOL ?? 'http';
  const apiKey   = process.env.TYPESENSE_API_KEY  ?? 'local-dev-key';

  return new Typesense.Client({
    nodes: [{ host, port, protocol }],
    apiKey,
    connectionTimeoutSeconds: 10,
    retryIntervalSeconds: 0.5,
    numRetries: 3,
  });
}

// ─── collection schema ────────────────────────────────────────────────────────

const SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'id',                 type: 'string'   },
    { name: 'tenantId',           type: 'string',   facet: true  },
    { name: 'releaseArtist',      type: 'string',   facet: true  },
    { name: 'releaseTitle',       type: 'string',   facet: true  },
    { name: 'releaseLabel',       type: 'string',   facet: false },
    { name: 'releaseGenre',       type: 'string[]', facet: true  },
    { name: 'releaseStyle',       type: 'string[]', facet: false },
    { name: 'releaseTrackTitles', type: 'string[]', facet: false },
    { name: 'releaseFormat',      type: 'string',   facet: true  },
    { name: 'releaseCountry',     type: 'string',   facet: true  },
    { name: 'releaseYear',        type: 'int32',    facet: true,  optional: true },
    { name: 'condition',          type: 'string',   facet: true  },
    { name: 'location',           type: 'string',   facet: true  },
    { name: 'notes',              type: 'string',   facet: false },
    { name: 'updatedAt',          type: 'int64'    },
  ],
  default_sorting_field: 'updatedAt',
};

// ─── document mapping ─────────────────────────────────────────────────────────

function toTypesenseDoc(tenantId, record) {
  return {
    id:                 record._id.toString(),
    tenantId,
    releaseArtist:      record.releaseArtist      ?? '',
    releaseTitle:       record.releaseTitle        ?? '',
    releaseLabel:       record.releaseLabel        ?? '',
    releaseGenre:       record.releaseGenre        ?? [],
    releaseStyle:       record.releaseStyle        ?? [],
    releaseTrackTitles: record.releaseTrackTitles  ?? [],
    releaseFormat:      record.releaseFormat       ?? '',
    releaseCountry:     record.releaseCountry      ?? '',
    releaseYear:        record.releaseYear         ?? 0,
    condition:          record.condition           ?? '',
    location:           record.location            ?? '',
    notes:              record.notes               ?? '',
    updatedAt:          record.updatedAt ? record.updatedAt.getTime() : Date.now(),
  };
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const stage = parseStage(values.stage);
  console.log(`\n🔍  Stage: ${stage}${DRY_RUN ? '  [DRY RUN]' : ''}\n`);

  const { registryClient, tenantClient, close } = await connect(stage);

  let tsClient;
  try {
    tsClient = buildTypesenseClient();
    console.log(`🔗  Typesense: ${process.env.TYPESENSE_HOST ?? 'localhost'}:${process.env.TYPESENSE_PORT ?? '8108'}`);
  } catch (err) {
    console.error('Failed to build Typesense client:', err.message);
    await close();
    process.exit(1);
  }

  try {
    // 1. Wipe and re-create the Typesense collection
    if (!DRY_RUN) {
      console.log('🗑   Dropping existing Typesense collection (if any)...');
      try {
        await tsClient.collections(COLLECTION_NAME).delete();
        console.log('    Collection dropped.');
      } catch (err) {
        if (err?.httpStatus !== 404) throw err;
        console.log('    Collection did not exist yet.');
      }

      console.log('📦  Creating Typesense collection...');
      await tsClient.collections().create(SCHEMA);
      console.log('    Collection created.\n');
    } else {
      console.log('    [DRY RUN] Would drop and recreate Typesense collection.\n');
    }

    // 2. List tenants
    const registryDb = registryClient.db('vinylvault_registry');
    const tenants = await registryDb
      .collection('tenants')
      .find({}, { projection: { tenantId: 1, databaseName: 1, name: 1 } })
      .toArray();

    if (tenants.length === 0) {
      console.log('ℹ️   No tenants found in registry. Nothing to sync.');
      return;
    }

    console.log(`👥  Found ${tenants.length} tenant(s)\n`);

    let totalDocs = 0;

    for (const tenant of tenants) {
      const { tenantId, databaseName, name } = tenant;
      const dbName = databaseName ?? getTenantDbName(tenantId);
      const db = tenantClient.db(dbName);

      const count = await db.collection('records').countDocuments();
      process.stdout.write(`  ▸ ${name ?? tenantId} (${tenantId}) — ${count} records`);

      if (count === 0) {
        console.log(' (skipped)');
        continue;
      }

      if (DRY_RUN) {
        console.log(' [would sync]');
        totalDocs += count;
        continue;
      }

      let synced = 0;
      let skip = 0;
      while (skip < count) {
        const batch = await db.collection('records').find().skip(skip).limit(BATCH_SIZE).toArray();
        const docs = batch.map((r) => toTypesenseDoc(tenantId, r));

        await tsClient.collections(COLLECTION_NAME).documents().import(docs, { action: 'upsert' });
        synced += docs.length;
        skip += docs.length;
        process.stdout.write(`\r  ▸ ${name ?? tenantId} — ${synced}/${count} records`);
      }
      console.log(' ✓');
      totalDocs += synced;
    }

    console.log(`\n✅  Sync complete — ${totalDocs} documents indexed`);

    if (!DRY_RUN) {
      // Reset the resume token so the sync worker picks up from now
      const registryDb2 = registryClient.db('vinylvault_registry');
      await registryDb2.collection('sync_state').deleteOne({ _id: 'changeStreamToken' });
      console.log('🔄  Cleared resume token — sync worker will resume from current position on restart');
    }
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error('\n❌  Fatal error:', err.message ?? err);
  process.exit(1);
});
