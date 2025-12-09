#!/usr/bin/env node
/**

/**
 * Quick reference for testing the current GitHub App installation flow
 *
 * Legacy flows (automatic org sync, release caching) have been removed.
 * Only the GitHub App installation flow is supported for onboarding organization tenants.
 *
 * Three scripts are available:
 * 1. send-installation-webhook.mjs - Simulate GitHub webhook (creation/deletion)
 * 2. call-setup-endpoint.mjs - Call the /auth/setup endpoint after installation
 * 3. test-installation-flow.mjs - Full end-to-end test combining both steps
 *
 */

console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║          GitHub App Installation Testing Scripts                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

📋 SCRIPT 1: send-installation-webhook.mjs
   Simulates GitHub's webhook for installation.created/deleted events
   
   Usage:
   $ node ./scripts/send-installation-webhook.mjs \
     --installationId=123456 \
     --account=my-org \
     --action=created \
     --secret=8gPQk0kx1QE2hehVSkOly7RKnAKp6nR4qDlwjjsO89k=

   Options:
   --installationId    GitHub installation ID (default: 123456)
   --account          GitHub organization login name (default: demo-org)
   --action           'created' or 'deleted' (default: created)
   --accountType      'Organization' or 'User' (default: Organization)
   --secret           GitHub webhook secret (can use env GITHUB_APP_WEBHOOK_SECRET)
   --url              Webhook endpoint (default: http://localhost:3001/webhook/github)


📋 SCRIPT 2: call-setup-endpoint.mjs
   Calls the /auth/setup endpoint to complete installation setup
   
   Usage:
   $ node ./scripts/call-setup-endpoint.mjs \
     --installationId=123456 \
     --testUserId=507f1f77bcf86cd799439011

   Options:
   --installationId   GitHub installation ID (must match webhook)
   --testUserId       MongoDB ObjectId for user in test mode (auto-generated if omitted)
   --session          Session cookie value (default: test-session-id)
   --url              Setup endpoint (default: http://localhost:3001/auth/setup)

   Note: In development mode (NODE_ENV=development), the testUserId parameter
   bypasses authentication and is used directly for testing. In production,
   the endpoint requires a real authenticated session.


📋 SCRIPT 3: test-installation-flow.mjs (RECOMMENDED)
   Runs both scripts in sequence for complete end-to-end testing
   
   Usage:
   $ node ./scripts/test-installation-flow.mjs \
     --installationId=123456 \
     --account=my-org \
     --secret=8gPQk0kx1QE2hehVSkOly7RKnAKp6nR4qDlwjjsO89k=

   Options:
   --installationId   GitHub installation ID (default: 123456)
   --account          GitHub organization name (default: demo-org)
   --secret           GitHub webhook secret (can use env GITHUB_APP_WEBHOOK_SECRET)
   --testUserId       MongoDB ObjectId for test user (auto-generated if omitted)
   --webhookUrl       Webhook endpoint (default: http://localhost:3001/webhook/github)
   --setupUrl         Setup endpoint (default: http://localhost:3001/auth/setup)
   --session          Session cookie (default: test-session-integration)


🧪 EXAMPLE TESTING SESSION
═══════════════════════════

# Start services
$ pnpm dev

# In another terminal, run the full test:
$ node ./scripts/test-installation-flow.mjs \
  --installationId=999888 \
  --account=test-org \
  --secret=8gPQk0kx1QE2hehVSkOly7RKnAKp6nR4qDlwjjsO89k=

# Or step by step:
$ node ./scripts/send-installation-webhook.mjs \
  --installationId=999888 \
  --account=test-org \
  --secret=8gPQk0kx1QE2hehVSkOly7RKnAKp6nR4qDlwjjsO89k=

$ node ./scripts/call-setup-endpoint.mjs \
  --installationId=999888


🔍 WHAT TO EXPECT
══════════════════

Webhook Script:
  ✅ Status: 200
  ✅ Response: {"ok":true,"backend":{"ok":true,"message":"Webhook processed"}}
  ✅ Backend logs: "[installations] Stored installation XXX for org-name (Organization)"

Setup Script:
  ✅ Status: 302 (Found - redirect)
  ✅ Location header: http://localhost:3000/?org_installed=org-name&installation_id=XXX
  ✅ New session cookie set (vinylvault.sid)
  ✅ Backend logs: "[setup] Successfully linked user to installation XXX"
  ✅ Backend logs: "[setup] Created organization tenant org-XXX"

Integration Script:
  ✅ Step 1: Webhook sent successfully
  ✅ Step 2: Setup endpoint called successfully
  ✅ Final message: "🎉 Full installation flow completed!"


📝 NOTES
════════

1. Test Mode (Development Only):
   - In development mode (NODE_ENV=development), the setup endpoint accepts a 
     --testUserId parameter that bypasses normal authentication
   - The testUserId must be a valid MongoDB ObjectId (24 hex characters)
   - The scripts automatically generate valid ObjectIds if not provided
   - This test mode is only active when NODE_ENV is set to 'development'

2. The webhook secret must match GITHUB_APP_WEBHOOK_SECRET in .env
   - The secret can be base64-encoded or plain text
   - The scripts automatically handle both formats

3. Installation IDs should be unique to test multiple scenarios

4. Session Cookies:
   - In test mode, any session cookie value is accepted
   - In production, real authenticated sessions are required

5. Database Verification:
   - After running the test, verify data was created in MongoDB
   - Check registry DB for installations and tenants:
     mongosh mongodb://localhost:37017/vinylvault_registry
     db.installations.find({ _id: 999999 })
     db.tenants.find({ tenantType: 'ORGANIZATION' })

6. Log Output:
   - BFF logs: "[setup] User {userId} setting up installation {installationId}"
   - Backend logs: "[completeInstallationSetup] User {userId} setting up..."
   - Check these logs to verify the flow is working

7. Legacy org sync and caching are no longer supported. All onboarding and testing should use the GitHub App installation flow only.
