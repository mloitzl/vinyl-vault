#!/usr/bin/env node
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
    userId: args.get('userId') || args.get('testUserId') || generateObjectId(),
    setupUrl: args.get('url') || process.env.BFF_SETUP_URL || 'http://localhost:3001/auth/setup',
    sessionCookie: args.get('session') || process.env.SESSION_COOKIE || 'test-session-id',
  };
}

async function main() {
  const opts = parseArgs();

  console.log(`Calling setup endpoint for installation ${opts.installationId}`);
  console.log(`Setup URL: ${opts.setupUrl}`);
  console.log(`Test User ID: ${opts.userId}`);
  console.log(`Session Cookie: ${opts.sessionCookie}`);

  const setupUrlWithParams = new URL(opts.setupUrl);
  setupUrlWithParams.searchParams.append('installation_id', opts.installationId.toString());
  setupUrlWithParams.searchParams.append('setup_action', 'install');
  setupUrlWithParams.searchParams.append('test_user_id', opts.userId); // For development testing

  try {
    const res = await fetch(setupUrlWithParams.toString(), {
      method: 'GET',
      headers: {
        Cookie: `vinylvault.sid=${opts.sessionCookie}`,
      },
      redirect: 'manual', // Don't follow redirects, just show them
    });

    console.log('\nResponse Status:', res.status);
    console.log('Response Headers:', Object.fromEntries(res.headers.entries()));

    const body = await res.text();
    if (body) {
      try {
        const json = JSON.parse(body);
        console.log('Response Body:', JSON.stringify(json, null, 2));
      } catch {
        console.log('Response Body:', body);
      }
    }

    // Check for redirect location
    const location = res.headers.get('location');
    if (location) {
      console.log('\n📍 Redirect Location:', location);
      const redirectUrl = new URL(location, opts.setupUrl);
      console.log('   org_installed:', redirectUrl.searchParams.get('org_installed'));
      console.log('   installation_id:', redirectUrl.searchParams.get('installation_id'));
    }

    // 302 redirect is a success for setup endpoint
    if (res.status === 302) {
      return; // Success
    }

    if (!res.ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error calling setup endpoint:', error);
    process.exit(1);
  }
}

main();
