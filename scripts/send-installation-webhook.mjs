#!/usr/bin/env node
import crypto from 'crypto';
import process from 'process';

function parseArgs() {
  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [k, v] = arg.split('=');
    if (k && v) args.set(k.replace(/^--/, ''), v);
  }
  return {
    action: args.get('action') || 'created',
    installationId: parseInt(args.get('installationId') || args.get('id') || '123456', 10),
    accountLogin: args.get('account') || 'demo-org',
    accountType: args.get('accountType') || 'Organization',
    secret: args.get('secret') || process.env.GITHUB_APP_WEBHOOK_SECRET || '',
    webhookUrl:
      args.get('url') || process.env.BFF_WEBHOOK_URL || 'http://localhost:3001/webhook/github',
  };
}

function buildPayload({ action, installationId, accountLogin, accountType }) {
  const now = new Date().toISOString();
  return {
    action,
    installation: {
      id: installationId,
      account: {
        login: accountLogin,
        id: 999,
        type: accountType,
      },
      app_id: 4242,
      created_at: now,
      events: ['issues'],
      permissions: { contents: 'read', metadata: 'read' },
      repositories_total_count: 0,
    },
    sender: {
      login: 'tester',
      id: 1,
      type: 'User',
    },
  };
}

function signPayload(secret, payload) {
  // If secret looks base64-encoded, decode it first
  let actualSecret = secret;
  if (secret && /^[A-Za-z0-9+/]+=*$/.test(secret)) {
    try {
      actualSecret = Buffer.from(secret, 'base64').toString('utf8');
      console.log('Decoded secret from base64');
    } catch {
      console.log('Secret decode failed, using as-is');
    }
  }

  const hmac = crypto.createHmac('sha256', actualSecret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

async function main() {
  const opts = parseArgs();
  if (!opts.secret) {
    console.error('Missing webhook secret. Pass --secret=... or set GITHUB_APP_WEBHOOK_SECRET');
    process.exit(1);
  }

  const payloadObj = buildPayload(opts);
  const payload = JSON.stringify(payloadObj);
  const signature = signPayload(opts.secret, payload);

  const res = await fetch(opts.webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
      'X-GitHub-Event': 'installation',
    },
    body: payload,
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);

  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
