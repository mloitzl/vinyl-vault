/**
 * One-off migration: copy users from `vinylvault` (legacy BFF DB) to
 * `vinylvault_registry` (registry DB).
 *
 * Safe to run multiple times — existing users in the registry are left
 * untouched (matched on githubId).
 *
 * Usage (from packages/backend):
 *   npx tsx src/scripts/migrate-users-to-registry.ts
 *
 * Env vars (same as the backend):
 *   MONGODB_URI          – legacy DB  (default: mongodb://localhost:27017/vinylvault)
 *   MONGODB_REGISTRY_URI – registry DB (default: mongodb://localhost:27017/vinylvault_registry)
 */

import { MongoClient } from 'mongodb';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env for local use; no-op in containers where k8s injects env vars
dotenvConfig({ path: resolve(__dirname, '../../../../.env') });

// In k8s the BFF URI is injected as MONGODB_BFF_URI from mongodb-secrets.
// Locally MONGODB_URI is the equivalent (single Mongo instance).
const LEGACY_URI = process.env.MONGODB_BFF_URI ?? process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vinylvault';
const REGISTRY_URI = process.env.MONGODB_REGISTRY_URI ?? 'mongodb://localhost:27017/vinylvault_registry';

async function migrate() {
  const legacyClient = new MongoClient(LEGACY_URI);
  const registryClient = new MongoClient(REGISTRY_URI);

  try {
    await Promise.all([legacyClient.connect(), registryClient.connect()]);

    const legacyUsers = legacyClient.db().collection('users');
    const registryUsers = registryClient.db().collection('users');

    const users = await legacyUsers.find({}).toArray();
    console.log(`Found ${users.length} user(s) in legacy DB.`);

    if (users.length === 0) {
      console.log('Nothing to migrate.');
      return;
    }

    let inserted = 0;
    let skipped = 0;

    for (const user of users) {
      const exists = await registryUsers.findOne({ githubId: user.githubId });
      if (exists) {
        console.log(`  skip  ${user.githubLogin} (already in registry)`);
        skipped++;
      } else {
        await registryUsers.insertOne(user);
        console.log(`  copy  ${user.githubLogin}`);
        inserted++;
      }
    }

    console.log(`\nDone. inserted=${inserted} skipped=${skipped}`);
  } finally {
    await Promise.all([legacyClient.close(), registryClient.close()]);
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
