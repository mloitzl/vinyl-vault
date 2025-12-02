// GitHub OAuth authentication handlers
// Implements GitHub OAuth Web Application Flow per Architecture.MD

import { Router, Request, Response, type IRouter } from 'express';
import { config } from '../config/env.js';
import { queryBackend } from '../services/backendClient.js';
import type { SessionUser } from '../types/session.js';

export const authRouter: IRouter = Router();

// GitHub OAuth URLs
const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

// GitHub OAuth login initiation
// Redirects user to GitHub for authentication
// Initiate GitHub OAuth flow
// Optional query params:
// - callback: one of the registered BFF callback URLs (must be allowed by GITHUB_CALLBACK_URLS or configured callback)
// - return_to: frontend URL to redirect to after successful login
authRouter.get('/github', (req: Request, res: Response) => {
  const candidateCallback = typeof req.query.callback === 'string' ? req.query.callback : undefined;
  const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : undefined;

  // Build allowed callbacks list from env or config
  const allowed = (process.env.GITHUB_CALLBACK_URLS || config.github.callbackUrl)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const redirectUri =
    candidateCallback && allowed.includes(candidateCallback)
      ? candidateCallback
      : config.github.callbackUrl;

  const state = generateState(redirectUri, returnTo);

  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state,
  });

  const authUrl = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  res.redirect(authUrl);
});

// GitHub OAuth callback
// Exchanges code for token, fetches user, creates session
authRouter.get('/github/callback', async (req: Request, res: Response) => {
  const { code, error, error_description, state } = req.query;

  // Handle OAuth errors from GitHub
  if (error) {
    console.error('GitHub OAuth error:', error, error_description);
    return res.redirect(`${config.frontend.url}?error=oauth_error`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${config.frontend.url}?error=missing_code`);
  }

  // Decode state to find which redirect_uri and optional return_to were used
  let usedRedirectUri = config.github.callbackUrl;
  let returnToUrl: string | undefined = undefined;
  if (state && typeof state === 'string') {
    try {
      const parts = state.split('|');
      if (parts.length >= 2) {
        const decodedRedirect = Buffer.from(parts[1], 'base64').toString('utf-8');
        if (decodedRedirect) usedRedirectUri = decodedRedirect;
      }
      if (parts.length >= 3) {
        const decodedReturn = Buffer.from(parts[2], 'base64').toString('utf-8');
        if (decodedReturn) returnToUrl = decodedReturn;
      }
    } catch {
      // ignore malformed state
    }
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: usedRedirectUri,
      }),
    });

    const tokenData = (await tokenResponse.json()) as GitHubTokenResponse;

    if (tokenData.error) {
      console.error('GitHub token error:', tokenData.error, tokenData.error_description);
      return res.redirect(`${config.frontend.url}?error=token_error`);
    }

    // Fetch user profile from GitHub
    const userResponse = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'VinylVault',
      },
    });

    if (!userResponse.ok) {
      console.error('GitHub user fetch failed:', userResponse.status);
      return res.redirect(`${config.frontend.url}?error=user_fetch_error`);
    }

    const githubUser = (await userResponse.json()) as GitHubUser;

    // Create or update user via Domain Backend
    const UPSERT_USER_MUTATION = `
      mutation UpsertUser($input: UpsertUserInput!) {
        upsertUser(input: $input) {
          id
          githubId
          githubLogin
          displayName
          avatarUrl
          email
          role
          createdAt
          updatedAt
        }
      }
    `;

    interface BackendUser {
      id: string;
      githubId: string;
      githubLogin: string;
      displayName: string;
      avatarUrl?: string;
      email?: string;
      role: 'ADMIN' | 'CONTRIBUTOR' | 'READER';
      createdAt: string;
      updatedAt: string;
    }

    const backendResult = await queryBackend<{ upsertUser: BackendUser }>(
      UPSERT_USER_MUTATION,
      {
        input: {
          githubId: String(githubUser.id),
          githubLogin: githubUser.login,
          displayName: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          email: githubUser.email,
        },
      }
    );

    const user = backendResult.upsertUser;

    // Create session with user data from backend
    const sessionUser: SessionUser = {
      id: user.id,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    req.session.user = sessionUser;

    // Save session and redirect to frontend
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${config.frontend.url}?error=session_error`);
      }
      // If a returnToUrl was provided in the initial request and is present in state, redirect there.
      // Otherwise fallback to configured frontend URL.
      const dest = returnToUrl || config.frontend.url;
      res.redirect(dest);
    });
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect(`${config.frontend.url}?error=server_error`);
  }
});

// Logout - destroy session and clear cookie
authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie(config.session.cookieName);
    res.json({ success: true });
  });
});

// Get current auth status - returns user or null
authRouter.get('/me', (req: Request, res: Response) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

// Generate a simple state parameter for CSRF protection
function generateState(redirectUri?: string, returnTo?: string): string {
  const rand = Math.random().toString(36).substring(2, 15);
  const parts = [rand];
  if (redirectUri) {
    try {
      parts.push(Buffer.from(redirectUri, 'utf-8').toString('base64'));
    } catch {
      parts.push('');
    }
  }
  if (returnTo) {
    try {
      parts.push(Buffer.from(returnTo, 'utf-8').toString('base64'));
    } catch {
      parts.push('');
    }
  }
  return parts.join('|');
}
