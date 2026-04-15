/**
 * MongoDB connection factory for admin scripts.
 *
 * Stage-specific behaviour:
 *   DEV     – connects to localhost with default ports (no auth)
 *   STAGING – fetches passwords from k8s Secrets and opens kubectl port-forwards
 *             automatically (cleans them up on process exit)
 *   DEMO    – reads URIs from .env.demo at the repo root, or from env vars
 *
 * Returns an object with three ready-to-use MongoClient instances:
 *   registryClient  – vinylvault_registry  (users, tenants, roles)
 *   tenantClient    – base client for all vv_* tenant databases
 *   bffClient       – vinylvault_bff       (sessions)
 */

import { MongoClient } from 'mongodb';
import { execSync, spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

const STAGING_NAMESPACE = 'vinylvault-staging';
const activePortForwards = [];

// ─── helpers ────────────────────────────────────────────────────────────────

function loadDotEnv(file) {
  if (!existsSync(file)) return {};
  const pairs = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    pairs[key] = val;
  }
  return pairs;
}

function k8sSecretValue(secretName, key, namespace) {
  try {
    const raw = execSync(
      `kubectl get secret ${secretName} -n ${namespace} -o jsonpath='{.data.${key}}'`,
      { stdio: ['pipe', 'pipe', 'pipe'] }
    ).toString().trim().replace(/^'|'$/g, '');
    return Buffer.from(raw, 'base64').toString('utf8');
  } catch (err) {
    throw new Error(
      `Failed to read k8s secret ${secretName}/${key} in ${namespace}.\n` +
      `Make sure kubectl is configured and you are connected to the right cluster.\n${err.message}`
    );
  }
}

function startPortForward(service, localPort, remotePort, namespace) {
  return new Promise((resolve, reject) => {
    const pf = spawn(
      'kubectl',
      ['port-forward', `svc/${service}`, `${localPort}:${remotePort}`, '-n', namespace],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let ready = false;
    const onData = (data) => {
      if (!ready && data.toString().includes('Forwarding from')) {
        ready = true;
        resolve(pf);
      }
    };
    pf.stdout.on('data', onData);
    pf.stderr.on('data', onData);

    pf.on('error', reject);
    pf.on('exit', (code) => {
      if (!ready) reject(new Error(`kubectl port-forward ${service} exited with code ${code}`));
    });

    setTimeout(() => {
      if (!ready) reject(new Error(`Timed out waiting for port-forward on ${service}:${localPort}`));
    }, 15_000);
  });
}

function stopPortForwards() {
  for (const pf of activePortForwards) {
    try { pf.kill('SIGTERM'); } catch { /* ignore */ }
  }
  activePortForwards.length = 0;
}

['exit', 'SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, stopPortForwards));

// ─── connection builders ─────────────────────────────────────────────────────

async function devUris() {
  return {
    registryUri: 'mongodb://localhost:27017/vinylvault_registry',
    uriBase:     'mongodb://localhost:27017',
    bffUri:      'mongodb://localhost:27017/vinylvault_bff',
  };
}

async function stagingUris() {
  console.log('⏳  Fetching k8s secrets...');
  const backendPwd = k8sSecretValue('mongodb-backend-secret', 'mongodb-root-password', STAGING_NAMESPACE);
  const bffPwd     = k8sSecretValue('mongodb-bff-secret',     'mongodb-root-password', STAGING_NAMESPACE);

  const encBackend = encodeURIComponent(backendPwd);
  const encBff     = encodeURIComponent(bffPwd);

  console.log('⏳  Starting port-forwards...');
  const [pfBackend, pfBff] = await Promise.all([
    startPortForward('mongodb-backend', 27018, 27017, STAGING_NAMESPACE),
    startPortForward('mongodb-bff',     27019, 27017, STAGING_NAMESPACE),
  ]);
  activePortForwards.push(pfBackend, pfBff);
  console.log('✅  Port-forwards ready (backend→27018, bff→27019)');

  // directConnection bypasses replica-set topology discovery, which would
  // otherwise redirect the driver to internal hostnames unresolvable from
  // outside the cluster.
  return {
    registryUri: `mongodb://root:${encBackend}@localhost:27018/vinylvault_registry?authSource=admin&directConnection=true`,
    uriBase:     `mongodb://root:${encBackend}@localhost:27018?authSource=admin&directConnection=true`,
    bffUri:      `mongodb://root:${encBff}@localhost:27019/vinylvault_bff?authSource=admin&directConnection=true`,
  };
}

async function demoUris() {
  const envFile = resolve(REPO_ROOT, '.env.demo');
  const env = { ...loadDotEnv(envFile), ...process.env };

  const registryUri = env.MONGODB_REGISTRY_URI;
  const uriBase     = env.MONGODB_URI_BASE;
  const bffUri      = env.MONGODB_URI;

  if (!registryUri || !uriBase || !bffUri) {
    throw new Error(
      'DEMO stage requires MONGODB_REGISTRY_URI, MONGODB_URI_BASE and MONGODB_URI.\n' +
      `Create ${envFile} or export them as env vars.`
    );
  }
  return { registryUri, uriBase, bffUri };
}

// ─── public API ─────────────────────────────────────────────────────────────

export const VALID_STAGES = ['DEV', 'STAGING', 'DEMO'];

export function parseStage(raw) {
  const stage = (raw ?? 'DEV').toUpperCase();
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`Unknown stage "${raw}". Valid values: ${VALID_STAGES.join(', ')}`);
  }
  return stage;
}

/**
 * Connect to all three MongoDB endpoints for the given stage.
 * Returns { registryClient, tenantClient, bffClient, close }.
 */
export async function connect(stage) {
  let uris;
  if      (stage === 'DEV')     uris = await devUris();
  else if (stage === 'STAGING') uris = await stagingUris();
  else if (stage === 'DEMO')    uris = await demoUris();
  else throw new Error(`Unsupported stage: ${stage}`);

  const [registryClient, tenantClient, bffClient] = await Promise.all([
    new MongoClient(uris.registryUri).connect(),
    new MongoClient(uris.uriBase).connect(),
    new MongoClient(uris.bffUri).connect(),
  ]);

  async function close() {
    await Promise.allSettled([
      registryClient.close(),
      tenantClient.close(),
      bffClient.close(),
    ]);
    stopPortForwards();
  }

  return { registryClient, tenantClient, bffClient, close };
}
