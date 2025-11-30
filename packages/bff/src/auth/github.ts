// GitHub OAuth authentication handlers
// Implements GitHub OAuth Web Application Flow per Architecture.MD

import { Router, Request, Response, type IRouter } from 'express';
import { config } from '../config/env.js';
import { getDatabase } from '../db/connection.js';
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
authRouter.get('/github', (_req: Request, res: Response) => {
  const params = new URLSearchParams({
    client_id: config.github.clientId,
    redirect_uri: config.github.callbackUrl,
    scope: 'read:user user:email',
    state: generateState(),
  });

  const authUrl = `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
  res.redirect(authUrl);
});

// GitHub OAuth callback
// Exchanges code for token, fetches user, creates session
authRouter.get('/github/callback', async (req: Request, res: Response) => {
  const { code, error, error_description } = req.query;

  // Handle OAuth errors from GitHub
  if (error) {
    console.error('GitHub OAuth error:', error, error_description);
    return res.redirect(`${config.frontend.url}?error=oauth_error`);
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(`${config.frontend.url}?error=missing_code`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.github.clientId,
        client_secret: config.github.clientSecret,
        code,
        redirect_uri: config.github.callbackUrl,
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
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'VinylVault',
      },
    });

    if (!userResponse.ok) {
      console.error('GitHub user fetch failed:', userResponse.status);
      return res.redirect(`${config.frontend.url}?error=user_fetch_error`);
    }

    const githubUser = (await userResponse.json()) as GitHubUser;

    // Create or update local user in MongoDB
    const db = getDatabase();
    const usersCollection = db.collection('users');

    const now = new Date();
    const existingUser = await usersCollection.findOne({ githubId: String(githubUser.id) });

    let userId: string;
    let userRole: 'ADMIN' | 'CONTRIBUTOR' | 'READER';

    if (existingUser) {
      // Update existing user
      await usersCollection.updateOne(
        { githubId: String(githubUser.id) },
        {
          $set: {
            githubLogin: githubUser.login,
            displayName: githubUser.name || githubUser.login,
            avatarUrl: githubUser.avatar_url,
            email: githubUser.email,
            updatedAt: now,
          },
        }
      );
      userId = existingUser._id.toString();
      userRole = existingUser.role;
    } else {
      // Create new user - first user becomes ADMIN, others become READER
      const userCount = await usersCollection.countDocuments();
      userRole = userCount === 0 ? 'ADMIN' : 'READER';

      const result = await usersCollection.insertOne({
        githubId: String(githubUser.id),
        githubLogin: githubUser.login,
        displayName: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email: githubUser.email,
        role: userRole,
        createdAt: now,
        updatedAt: now,
      });
      userId = result.insertedId.toString();
    }

    // Create session with user data
    const sessionUser: SessionUser = {
      id: userId,
      githubId: String(githubUser.id),
      githubLogin: githubUser.login,
      displayName: githubUser.name || githubUser.login,
      avatarUrl: githubUser.avatar_url,
      email: githubUser.email || undefined,
      role: userRole,
    };

    req.session.user = sessionUser;

    // Save session and redirect to frontend
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect(`${config.frontend.url}?error=session_error`);
      }
      res.redirect(config.frontend.url);
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
function generateState(): string {
  return Math.random().toString(36).substring(2, 15);
}
