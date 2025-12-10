#!/usr/bin/env node
/**
 * Full GitHub App installation flow test
 * 1. Sends installation.created webhook
 * 2. Calls /setup endpoint to complete the flow
 */

import { spawn } from 'child_process';
import process from 'process';

// Generate a valid MongoDB ObjectId
function generateObjectId() {
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split('=');
    if (k && v) args.set(k.replace(/^--/, ''), v);
  }
  return {
    installationId: parseInt(args.get('installationId') || args.get('id') || '123456', 10),
    account: args.get('account') || 'demo-org',
    secret: args.get('secret') || process.env.GITHUB_APP_WEBHOOK_SECRET || '',
    webhookUrl: args.get('webhookUrl') || 'http://localhost:3001/webhook/github',
    setupUrl: args.get('setupUrl') || 'http://localhost:3001/auth/setup',
    sessionCookie: args.get('session') || 'test-session-integration',
    testUserId: args.get('testUserId') || generateObjectId(),
  };
}

function runCommand(script, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️  Running: node ${script} ${args.join(' ')}\n`);

    const proc = spawn('node', [script, ...args], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', reject);
  });
}

async function main() {
  const opts = parseArgs();

  if (!opts.secret) {
    console.error('Missing webhook secret. Pass --secret=... or set GITHUB_APP_WEBHOOK_SECRET');
    process.exit(1);
  }

  console.log('='.repeat(70));
  console.log('🎯 GitHub App Installation Flow Test');
  console.log('='.repeat(70));
  console.log(`Installation ID: ${opts.installationId}`);
  console.log(`Organization: ${opts.account}`);
  console.log(`Webhook URL: ${opts.webhookUrl}`);
  console.log(`Setup URL: ${opts.setupUrl}`);

  try {
    // Step 1: Send webhook
    console.log('\n' + '='.repeat(70));
    console.log('Step 1: Send GitHub Webhook (installation.created)');
    console.log('='.repeat(70));

    await runCommand('./scripts/send-installation-webhook.mjs', [
      `--action=created`,
      `--installationId=${opts.installationId}`,
      `--account=${opts.account}`,
      `--secret=${opts.secret}`,
      `--url=${opts.webhookUrl}`,
    ]);

    console.log('\n✅ Webhook sent successfully');

    // Step 2: Call setup endpoint
    console.log('\n' + '='.repeat(70));
    console.log('Step 2: Call Setup Endpoint (/auth/setup)');
    console.log('='.repeat(70));

    await runCommand('./scripts/call-setup-endpoint.mjs', [
      `--installationId=${opts.installationId}`,
      `--url=${opts.setupUrl}`,
      `--session=${opts.sessionCookie}`,
      `--testUserId=${opts.testUserId}`,
    ]);

    console.log('\n✅ Setup endpoint called successfully');

    console.log('\n' + '='.repeat(70));
    console.log('🎉 Full installation flow completed!');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
