#!/usr/bin/env node
/**
 * klogs - Stream pino JSON logs from multiple k8s pods into one console.
 *
 * Usage:
 *   node scripts/klogs.mjs [namespace] [app-labels...]
 *
 * Examples:
 *   node scripts/klogs.mjs                              # backend + bff in vinylvault-staging
 *   node scripts/klogs.mjs vinylvault-staging backend   # only backend pods
 *   node scripts/klogs.mjs vinylvault-staging backend bff frontend
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

const NAMESPACE = process.argv[2] ?? 'vinylvault-staging';
const APPS = process.argv.slice(3).length ? process.argv.slice(3) : ['backend', 'bff'];

// ANSI colours — one per pod (cycles if more pods than colours)
const POD_COLORS = ['\x1b[36m', '\x1b[33m', '\x1b[35m', '\x1b[34m', '\x1b[32m', '\x1b[31m'];
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

// Pino level number → label
const LEVEL_LABELS = { 10: 'TRACE', 20: 'DEBUG', 30: ' INFO', 40: ' WARN', 50: 'ERROR', 60: 'FATAL' };
const LEVEL_COLORS = {
  10: '\x1b[2m',    // dim
  20: '\x1b[2m',    // dim
  30: '\x1b[32m',   // green
  40: '\x1b[33m',   // yellow
  50: '\x1b[31m',   // red
  60: '\x1b[41m',   // red bg
};

function formatTimestamp(ms) {
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '');
}

function formatLine(podName, podColor, raw) {
  const prefix = `${podColor}${podName.padEnd(40)}${RESET} `;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return prefix + raw; }

  const ts = parsed.time ? `${DIM}${formatTimestamp(parsed.time)}${RESET} ` : '';
  const levelNum = parsed.level ?? 30;
  const levelLabel = LEVEL_LABELS[levelNum] ?? String(levelNum).padStart(5);
  const levelColor = LEVEL_COLORS[levelNum] ?? '';
  const level = `${levelColor}${BOLD}${levelLabel}${RESET} `;
  const msg = parsed.msg ?? parsed.message ?? '';

  // Collect extra fields (skip the standard pino fields)
  const skip = new Set(['time', 'level', 'pid', 'hostname', 'name', 'msg', 'message', 'v']);
  const extras = Object.entries(parsed)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => `${DIM}${k}=${typeof v === 'object' ? JSON.stringify(v) : v}${RESET}`)
    .join(' ');

  return `${prefix}${ts}${level}${msg}${extras ? '  ' + extras : ''}`;
}

async function getPodsForApp(app) {
  return new Promise((resolve, reject) => {
    const proc = spawn('kubectl', [
      'get', 'pods',
      '-n', NAMESPACE,
      '-l', `app=${app}`,
      '--field-selector=status.phase=Running',
      '-o', 'jsonpath={.items[*].metadata.name}',
    ]);
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.on('close', (code) => {
      if (code !== 0) { reject(new Error(`kubectl get pods failed for app=${app}`)); return; }
      resolve(out.trim().split(/\s+/).filter(Boolean));
    });
  });
}

function streamPodLogs(podName, podColor) {
  const proc = spawn('kubectl', ['logs', '-n', NAMESPACE, '-f', '--tail=50', podName]);
  const rl = createInterface({ input: proc.stdout });
  rl.on('line', (line) => {
    if (line.trim()) console.log(formatLine(podName, podColor, line));
  });
  proc.stderr.on('data', (d) => {
    process.stderr.write(`${podColor}[${podName}]${RESET} ${d}`);
  });
  proc.on('close', (code) => {
    if (code !== 0) console.error(`${podColor}[${podName}] exited (${code})${RESET}`);
  });
  return proc;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`${BOLD}Streaming logs from namespace: ${NAMESPACE}  apps: ${APPS.join(', ')}${RESET}\n`);

let colorIndex = 0;
const procs = [];

for (const app of APPS) {
  let pods;
  try {
    pods = await getPodsForApp(app);
  } catch (err) {
    console.error(`Failed to list pods for ${app}: ${err.message}`);
    continue;
  }

  if (pods.length === 0) {
    console.warn(`No running pods found for app=${app} in ${NAMESPACE}`);
    continue;
  }

  for (const pod of pods) {
    const color = POD_COLORS[colorIndex++ % POD_COLORS.length];
    console.log(`${color}↳ Attaching to ${pod}${RESET}`);
    procs.push(streamPodLogs(pod, color));
  }
}

if (procs.length === 0) {
  console.error('No pods found. Exiting.');
  process.exit(1);
}

// Graceful exit on Ctrl-C
process.on('SIGINT', () => {
  console.log('\nDetaching…');
  procs.forEach((p) => p.kill());
  process.exit(0);
});
