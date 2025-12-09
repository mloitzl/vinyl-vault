# Testing GitHub App Webhooks Locally with ngrok

This guide explains how to test the GitHub App installation webhook locally using ngrok to tunnel your local BFF server to the internet.

## Why ngrok?

GitHub webhooks must be delivered to a public, internet-accessible URL. Since your local development environment isn't publicly accessible, ngrok creates a tunnel that forwards requests from a public URL to your local `localhost:3001`.

## Prerequisites

- BFF running locally on `http://localhost:3001`
- GitHub App configured with:
  - `GITHUB_APP_ID`
  - `GITHUB_APP_PRIVATE_KEY_PATH`
  - `GITHUB_APP_WEBHOOK_SECRET`
- ngrok installed: https://ngrok.com/download

## Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

## Step 2: Start Your Local Development Environment

```bash
cd /Users/martin/git/vinyl-vault
pnpm dev
```

This starts:
- Frontend: `http://localhost:3000`
- BFF: `http://localhost:3001`
- Backend: `http://localhost:4000`

## Step 3: Start ngrok Tunnel

Open a new terminal and run:

```bash
ngrok http 3001
```

This will display output like:

```
ngrok                                       (Ctrl+C to quit)

Session Status                online
Account                       [your-email@example.com]
Version                        3.x.x
Region                         us-east
Latency                         8ms
Web Interface                   http://127.0.0.1:4040
Forwarding                      https://abc123def456.ngrok.io -> http://localhost:3001
```

**Copy the HTTPS forwarding URL** (e.g., `https://abc123def456.ngrok.io`)

## Step 4: Update GitHub App Webhook URL

1. Go to your GitHub App settings: https://github.com/settings/apps/vinyl-vault-multiuser
2. Navigate to **Webhook** settings
3. Update **Webhook URL** to: `https://abc123def456.ngrok.io/webhook/github`
4. Keep **Webhook Secret** as is (should already be set from your `.env`)
5. Save changes

## Step 5: Test the Webhook

You have several options to test:

### Option A: Using the GitHub App Test Script

```bash
cd /Users/martin/git/vinyl-vault
node scripts/send-installation-webhook.mjs
```

This script:
- Generates a valid webhook signature using your `GITHUB_APP_WEBHOOK_SECRET`
- Sends a simulated GitHub `installation` event to your ngrok URL
- Tests the complete webhook processing

### Option B: Using curl

```bash
# Get your webhook secret (from .env or GitHub App settings)
WEBHOOK_SECRET="your-secret-here"
NGROK_URL="https://abc123def456.ngrok.io"

# Create test payload
PAYLOAD='{
  "action": "created",
  "installation": {
    "id": 12345678,
    "account": {
      "login": "test-org",
      "type": "Organization"
    }
  }
}'

# Generate HMAC signature
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -hex | cut -d' ' -f2)

# Send webhook
curl -X POST "$NGROK_URL/webhook/github" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
  -H "X-GitHub-Event: installation" \
  -d "$PAYLOAD"
```

### Option C: Trigger a Real Installation

If your GitHub App is properly configured:

1. On your GitHub profile, install the app on an organization you manage
2. GitHub will POST the webhook to your ngrok URL
3. Watch the logs in the BFF terminal for processing

## Step 6: Monitor Webhook Processing

Watch the BFF logs in your terminal where `pnpm dev` is running:

```
[webhook] Received webhook for installation: 12345678
[webhook] Forwarding to backend...
[webhook] Backend response: { ok: true, message: 'Installation webhook processed' }
```

## ngrok Web Interface

ngrok provides a web interface at `http://127.0.0.1:4040` where you can:

- **View all webhook requests** in real-time
- **Inspect headers and payload**
- **Replay requests** for testing
- **See responses** from your server

Simply open http://127.0.0.1:4040 in your browser while ngrok is running.

## Troubleshooting

### Webhook Returns 401 (Invalid Signature)

**Symptom:** Webhook rejected with "Invalid signature"

**Solutions:**
1. Verify `GITHUB_APP_WEBHOOK_SECRET` in `.env` matches GitHub App settings
2. Check secret isn't base64-encoded incorrectly (our code auto-detects, but verify)
3. Ensure webhook payload hasn't been modified in transit
4. Use ngrok web interface to view exact payload received

**Debug:**
```bash
# Check your current secret
grep GITHUB_APP_WEBHOOK_SECRET .env

# Compare with GitHub App settings
# https://github.com/settings/apps/vinyl-vault-multiuser -> Webhook
```

### Webhook Returns 404

**Symptom:** ngrok shows 404 response

**Solutions:**
1. Verify ngrok URL is correct: `https://abc123def456.ngrok.io/webhook/github`
2. Ensure BFF is running: `pnpm dev`
3. Check ngrok is forwarding to port 3001 (not 3000)
4. Verify GitHub App webhook URL is exactly: `{ngrok-url}/webhook/github`

### ngrok Connection Drops

**Symptom:** Tunnel becomes inactive

**Solutions:**
1. ngrok free tier may disconnect if inactive - just restart: `ngrok http 3001`
2. Use a custom URL with ngrok account (requires pro plan)
3. For development, use the test scripts instead

### Webhook Processing Error in Backend

**Symptom:** Webhook accepted (200 OK) but processing fails

**Solutions:**
1. Check MongoDB is running: `docker ps | grep mongo`
2. Verify backend is running: check `pnpm dev` output
3. Check backend logs for GraphQL errors
4. Verify `GITHUB_APP_INSTALLATION_URL` is set in `.env`

## Environment Variables Required

Ensure these are set in `.env`:

```bash
# GitHub OAuth (existing)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# GitHub App (new)
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY_PATH=...
GITHUB_APP_WEBHOOK_SECRET=...
GITHUB_APP_INSTALLATION_URL=https://github.com/apps/vinyl-vault-multiuser/installations/new
```

## Complete Testing Workflow

1. **Start dev environment:**
   ```bash
   cd /Users/martin/git/vinyl-vault
   pnpm dev
   ```

2. **In a new terminal, start ngrok:**
   ```bash
   ngrok http 3001
   ```

3. **Copy ngrok URL and update GitHub App** (or skip if using test script)

4. **Test webhook:**
   ```bash
   node scripts/send-installation-webhook.mjs
   # Or use curl/GitHub interface
   ```

5. **Monitor:**
   - BFF logs in first terminal
   - ngrok web interface: http://127.0.0.1:4040
   - Database: `docker exec mongo mongosh` if needed

6. **Verify:**
   - Check `installations` collection in MongoDB
   - Verify `installation_id` matches webhook
   - Check `user_installation_roles` created correctly

## Integration with Setup Flow

After webhook processes successfully, complete the setup flow:

```bash
# In another terminal
node scripts/call-setup-endpoint.mjs
```

This simulates the full flow:
1. GitHub redirects user from installation page
2. BFF /auth/setup creates tenant
3. Frontend redirects to app with ?org_installed parameter
4. UI shows success notification

## Useful ngrok Commands

```bash
# Start ngrok with custom region (faster)
ngrok http 3001 --region us

# View ngrok status
ngrok status

# Inspect specific webhook request
# (Use web interface at http://127.0.0.1:4040)

# Start ngrok in background
ngrok http 3001 &
```

## Security Notes

- **ngrok URLs are temporary** and change each session
- Always update GitHub App webhook URL when ngrok URL changes
- ngrok URLs are publicly accessible - don't expose sensitive data
- In production, use your actual domain (not ngrok)
- Never commit ngrok URLs to version control

## Next Steps

After validating webhook processing with ngrok:

1. **Manual GitHub App Test:** Install app on real GitHub org
2. **End-to-End Test:** Complete full flow from installation to UI
3. **Edge Cases:** Test duplicate installations, revocation, etc.
4. **Production:** Deploy to actual hosted environment
