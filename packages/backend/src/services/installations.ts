// Installation service handles GitHub App installation lifecycle persistence in the registry DB

import { ObjectId } from 'mongodb';
import { getRegistryDb } from '../db/registry.js';
import { logger } from '../utils/logger.js';

export async function upsertInstallationFromEvent(event: any): Promise<void> {
  const db = await getRegistryDb();
  const installation = event?.installation;
  if (!installation) return;

  const account = installation.account || {};

  await db.collection('installations').updateOne(
    { installation_id: installation.id },
    {
      $set: {
        installation_id: installation.id,
        account_login: account.login,
        account_type: account.type,
        account_id: account.id,
        repositories_count:
          installation.repositories_count ?? installation.repositories_total_count,
        created_at: installation.created_at ? new Date(installation.created_at) : new Date(),
        updated_at: new Date(),
      },
      $setOnInsert: {
        installed_by_user_id: null,
        installed_at: null,
      },
    },
    { upsert: true }
  );

  logger.info(
    {
      installationId: installation.id,
      accountLogin: account.login,
      accountType: account.type ?? 'unknown',
    },
    'Stored installation'
  );
}

export async function deleteInstallationFromEvent(event: any): Promise<void> {
  const db = await getRegistryDb();
  const installation = event?.installation;
  if (!installation) return;

  await db.collection('installations').deleteOne({ installation_id: installation.id });
  await db.collection('user_installation_roles').deleteMany({ installation_id: installation.id });

  logger.info({ installationId: installation.id }, 'Deleted installation');
}

// Lookup installation by ID
export async function getInstallationById(installationId: number): Promise<any> {
  const db = await getRegistryDb();
  return db.collection('installations').findOne({ installation_id: installationId });
}

// Wait for installation to arrive (webhook may race the setup redirect)
export async function waitForInstallation(
  installationId: number,
  timeoutMs: number = 5000,
  intervalMs: number = 500
): Promise<any | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const found = await getInstallationById(installationId);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

// Link user to installation with a role
export async function linkUserToInstallation(
  userId: ObjectId,
  installationId: number,
  role: string = 'ADMIN'
): Promise<void> {
  const db = await getRegistryDb();

  // Get the installation to get org name
  const installation = await db
    .collection('installations')
    .findOne({ installation_id: installationId });
  if (!installation) {
    throw new Error(`Installation ${installationId} not found`);
  }

  const orgName = installation.account_login;

  const now = new Date();
  const userInstallationRole = {
    _id: new ObjectId(),
    user_id: userId,
    installation_id: installationId,
    org_name: orgName,
    role,
    created_at: now,
    updated_at: now,
  };

  try {
    await db.collection('user_installation_roles').insertOne(userInstallationRole);
    logger.info(
      { userId: userId.toString(), installationId, orgName, role },
      'Linked user to installation'
    );
  } catch (err: any) {
    if (err.code === 11000) {
      // User already linked to this installation
      logger.info(
        { userId: userId.toString(), installationId },
        'User already linked to installation'
      );
    } else {
      throw err;
    }
  }
}
