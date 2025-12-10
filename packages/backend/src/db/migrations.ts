/**
 * Database migration utilities for schema and data changes.
 */

import { Db } from 'mongodb';
import { COLLECTIONS } from './collections.js';

/**
 * Migrate user roles from old naming to new unified model.
 * - CONTRIBUTOR → MEMBER
 * - READER → VIEWER
 * - ADMIN → ADMIN (no change)
 *
 * This migration is idempotent - it can be run multiple times safely.
 */
export async function migrateUserRoles(db: Db): Promise<void> {
  const usersCollection = db.collection(COLLECTIONS.USERS);

  try {
    // Migrate CONTRIBUTOR → MEMBER
    const contributorResult = await usersCollection.updateMany(
      { role: 'CONTRIBUTOR' },
      { $set: { role: 'MEMBER', updatedAt: new Date() } }
    );

    if (contributorResult.modifiedCount > 0) {
      console.log(
        `✅ Migrated ${contributorResult.modifiedCount} users from CONTRIBUTOR to MEMBER`
      );
    }

    // Migrate READER → VIEWER
    const readerResult = await usersCollection.updateMany(
      { role: 'READER' },
      { $set: { role: 'VIEWER', updatedAt: new Date() } }
    );

    if (readerResult.modifiedCount > 0) {
      console.log(`✅ Migrated ${readerResult.modifiedCount} users from READER to VIEWER`);
    }

    // Verify migration succeeded - ensure no old roles remain
    const oldRoleCount = await usersCollection.countDocuments({
      role: { $in: ['CONTRIBUTOR', 'READER'] },
    });

    if (oldRoleCount > 0) {
      throw new Error(
        `Migration incomplete: ${oldRoleCount} users still have old role values`
      );
    }

    console.log('✅ User role migration completed successfully');
  } catch (error) {
    console.error('❌ User role migration failed:', error);
    throw error;
  }
}

/**
 * Run all pending database migrations.
 * This function should be called during application startup.
 */
export async function runMigrations(db: Db): Promise<void> {
  console.log('🔄 Running database migrations...');

  try {
    await migrateUserRoles(db);
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
