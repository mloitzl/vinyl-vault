# GitHub OAuth Setup Guide

This guide walks you through setting up GitHub OAuth authentication for Vinyl Vault.

## Prerequisites

- A GitHub account
- Your Vinyl Vault application running (or ready to run)

## Step 1: Create a GitHub OAuth Application

1. **Go to GitHub Developer Settings**
   - Log in to GitHub
   - Click your profile picture → **Settings**
   - Scroll down and click **Developer settings** (left sidebar)
   - Click **OAuth Apps** → **New OAuth App**

   Or go directly to: https://github.com/settings/applications/new

2. **Fill in the Application Details**

   | Field | Development Value | Production Value |
   |-------|-------------------|------------------|
   | **Application name** | `Vinyl Vault (Dev)` | `Vinyl Vault` |
   | **Homepage URL** | `http://localhost:3000` | `https://yourdomain.com` |
   | **Application description** | (Optional) A vinyl record collection manager | Same |
   | **Authorization callback URL** | `http://localhost:3001/auth/github/callback` | `https://yourdomain.com/auth/github/callback` |

   > ⚠️ **Important**: The callback URL must match EXACTLY what you configure in your `.env` file, including the protocol (`http` vs `https`) and any trailing slashes.

3. **Register the Application**
   - Click **Register application**

4. **Get Your Credentials**
   - You'll see your **Client ID** - copy this
   - Click **Generate a new client secret**
   - Copy the **Client Secret** immediately (you won't be able to see it again!)

## Step 2: Configure Environment Variables

1. **Copy the sample environment file**

   ```bash
   cp .env.sample .env
   ```

2. **Edit `.env` and add your GitHub credentials**

   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
   ```

3. **Generate secure secrets** for JWT and sessions:

   ```bash
   # On Linux/macOS/WSL:
   openssl rand -base64 32
   
   # On Windows PowerShell:
   [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
   
   # Or use Node.js:
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   Add these to your `.env`:
   ```env
   JWT_SECRET=your_generated_secret_1
   SESSION_SECRET=your_generated_secret_2
   ```

## Step 3: Verify Your Setup

1. **Start the application**

   ```bash
   pnpm dev
   ```

2. **Test the OAuth flow**
   - Open http://localhost:3000
   - Click "Sign in with GitHub"
   - You should be redirected to GitHub to authorize
   - After authorizing, you should be redirected back to your app

## Troubleshooting

### "The redirect_uri is not valid"

- Ensure the callback URL in your `.env` matches EXACTLY what's configured in GitHub
- Check for typos, trailing slashes, and http vs https

### "Client ID not found"

- Verify `GITHUB_CLIENT_ID` is set correctly in `.env`
- Make sure you're using the OAuth App credentials, not a GitHub App

### "Bad credentials" or "Client secret is invalid"

- Regenerate the client secret in GitHub and update `.env`
- Ensure there are no extra spaces or newlines in the secret

### Callback returns 404

- Verify the BFF server is running on port 3001
- Check that the `/auth/github/callback` route is properly configured

## Production Considerations

### 1. Use HTTPS

For production, you MUST use HTTPS. Update your callback URL:
```env
GITHUB_CALLBACK_URL=https://yourdomain.com/auth/github/callback
```

### 2. Create a Separate OAuth App

Create a new OAuth App for production with:
- Production homepage URL
- Production callback URL

### 3. Secure Your Secrets

- Never commit `.env` to version control
- Use environment variables or a secrets manager in production
- Rotate secrets periodically

### 4. Set Proper Cookie Options

In production, ensure session cookies use:
```javascript
{
  httpOnly: true,
  secure: true,  // Requires HTTPS
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000  // 24 hours
}
```

## OAuth Flow Overview

```
┌─────────────┐     1. Click Login      ┌─────────────┐
│   Browser   │ ──────────────────────▶ │     BFF     │
│  (Frontend) │                         │  Port 3001  │
└─────────────┘                         └─────────────┘
       │                                       │
       │                                       │ 2. Redirect to GitHub
       │                                       ▼
       │                               ┌─────────────┐
       │                               │   GitHub    │
       │  3. User authorizes           │    OAuth    │
       │◀─────────────────────────────▶│             │
       │                               └─────────────┘
       │                                       │
       │                                       │ 4. Redirect with code
       ▼                                       ▼
┌─────────────┐     5. Exchange code    ┌─────────────┐
│   Browser   │ ◀────────────────────── │     BFF     │
│             │     (set session)       │             │
└─────────────┘                         └─────────────┘
       │                                       │
       │                                       │ 6. Create/update user
       │                                       ▼
       │                               ┌─────────────┐
       │                               │   Backend   │
       │                               │  + MongoDB  │
       │                               └─────────────┘
       │
       ▼
    Logged in!
```

## Additional Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps/authorizing-oauth-apps)
- [GitHub OAuth Scopes](https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps)
- [OAuth 2.0 Specification](https://oauth.net/2/)
