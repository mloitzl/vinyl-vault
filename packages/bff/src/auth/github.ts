// GitHub OAuth authentication handlers
// Implements GitHub OAuth Web Application Flow per Architecture.MD

import { Router, Request, Response, type IRouter } from 'express';
import { config } from '../config/env.js';
import { queryBackend } from '../services/backendClient.js';
import { signJwt } from './jwt.js';
import { handleSetup } from './setup.js';
import type { SessionUser, AvailableTenant } from '../types/session.js';
import { setActiveTenant, setAvailableTenants } from '../types/session.js';

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
    scope: 'read:user user:email read:org',
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

    // GitHub's /user endpoint only includes `email` when the user has made
    // their email public. If it's null, fetch the user's emails using the
    // `user:email` scope and pick the primary verified email when available.
    let primaryEmail: string | null = githubUser.email ?? null;
    if (!primaryEmail) {
      try {
        const emailsResponse = await fetch(`${GITHUB_USER_URL}/emails`, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'VinylVault',
          },
        });
        if (emailsResponse.ok) {
          const emails = await emailsResponse.json();
          if (Array.isArray(emails) && emails.length > 0) {
            const primary =
              emails.find((e: any) => e.primary && e.verified) ||
              emails.find((e: any) => e.verified) ||
              emails[0];
            if (primary && primary.email) primaryEmail = String(primary.email);
          }
        } else {
          console.warn('GitHub emails fetch failed:', emailsResponse.status);
        }
      } catch (e) {
        console.warn('Failed to fetch GitHub emails:', e);
      }
    }

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
      createdAt: string;
      updatedAt: string;
    }

    const backendResult = await queryBackend<{ upsertUser: BackendUser }>(UPSERT_USER_MUTATION, {
      input: {
        githubId: String(githubUser.id),
        githubLogin: githubUser.login,
        displayName: githubUser.name || githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email: primaryEmail,
      },
    });

    const user = backendResult.upsertUser;

    // Create personal tenant for user on first login (Phase 3)
    // Check if user already has a personal tenant
    const GET_USER_TENANTS_QUERY = `
      query GetUserTenants($userId: ID!) {
        userTenants(userId: $userId) {
          userId
          tenantId
          role
          createdAt
        }
      }
    `;

    interface UserTenant {
      userId: string;
      tenantId: string;
      role: 'ADMIN' | 'MEMBER' | 'VIEWER';
      createdAt: string;
    }

    interface GetUserTenantsResult {
      userTenants: UserTenant[];
    }

    let userTenants: UserTenant[] = [];
    let personalTenantId: string | undefined;

    try {
      const tenantResult = await queryBackend<GetUserTenantsResult>(GET_USER_TENANTS_QUERY, {
        userId: user.id,
      });
      userTenants = tenantResult.userTenants || [];
      personalTenantId = userTenants.find((t) => t.tenantId.startsWith('user_'))?.tenantId;
      console.log(`[github.callback] Found ${userTenants.length} existing tenants for user`);
      if (personalTenantId) {
        console.log(`[github.callback] Personal tenant already exists: ${personalTenantId}`);
      }
    } catch (err) {
      console.warn('Failed to fetch user tenants:', err);
    }

    // If no personal tenant exists, create one
    if (!personalTenantId) {
      console.log('[github.callback] No personal tenant found, creating new one...');
      const CREATE_TENANT_MUTATION = `
        mutation CreateTenant($input: CreateTenantInput!) {
          createTenant(input: $input) {
            tenantId
            tenantType
            name
            databaseName
            createdAt
          }
        }
      `;

      interface CreateTenantPayload {
        tenantId: string;
        tenantType: string;
        name: string;
        databaseName: string;
        createdAt: string;
      }

      // Sign a short-lived JWT so the backend sees the authenticated user in context
      const serviceJwt = signJwt({
        sub: user.id,
        username: user.displayName || user.githubLogin,
        avatarUrl: user.avatarUrl,
        tenantId: `user_${user.id}`,
        tenantRole: 'ADMIN',
        githubLogin: user.githubLogin,
      });

      try {
        const tenantCreateResult = await queryBackend<{ createTenant: CreateTenantPayload }>(
          CREATE_TENANT_MUTATION,
          {
            input: {
              tenantType: 'USER',
              name: user.displayName || user.githubLogin,
            },
          },
          { jwt: serviceJwt }
        );
        personalTenantId = tenantCreateResult.createTenant.tenantId;
        console.log(`[github.callback] Created personal tenant for user: ${personalTenantId}`);
      } catch (err) {
        console.error('Failed to create personal tenant:', err);
        // Non-fatal: continue without tenant (will be created on next login)
      }
    }

    // Set activeTenantId in session to personal tenant
    const activeTenantId = personalTenantId || `user_${user.id}`;

    const activeTenantRole =
      userTenants.find((t) => t.tenantId === activeTenantId)?.role || 'ADMIN';

    // Sign JWT for backend operations
    const jwt = signJwt({
      sub: user.id,
      username: user.displayName || user.githubLogin,
      avatarUrl: user.avatarUrl,
      tenantId: activeTenantId,
      tenantRole: activeTenantRole,
      githubLogin: user.githubLogin,
    });

    // Fetch all available tenants for user (personal + organizations)
    let availableTenants: AvailableTenant[] = [];
    try {
      const tenantsResult = await queryBackend<{ userTenants: AvailableTenant[] }>(
        `
        query GetUserTenants($userId: ID!) {
          userTenants(userId: $userId) {
            tenantId
            tenantType
            name
            role
          }
        }
        `,
        { userId: user.id },
        { jwt }
      );
      availableTenants = tenantsResult.userTenants || [];
      console.log(`[github.callback] User has ${availableTenants.length} available tenants`);
    } catch (err: any) {
      console.warn(
        `[github.callback] Failed to fetch user tenants: ${err?.message || String(err)}`
      );
      // Fallback to just personal tenant
      availableTenants = [
        {
          tenantId: activeTenantId,
          tenantType: 'USER',
          name: user.displayName || user.githubLogin,
          role: 'ADMIN',
        },
      ];
    }

    // Create session with user data and tenant context
    const sessionUser: SessionUser = {
      id: user.id,
      githubId: user.githubId,
      githubLogin: user.githubLogin,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    req.session.user = sessionUser;

    // Set activeTenantId in session (from session.ts helpers)
    setActiveTenant(req.session, activeTenantId);

    // Store available tenants in session
    setAvailableTenants(req.session, availableTenants);

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
    // Include tenant information from session
    const availableTenants = (req.session as any).availableTenants || [];
    const activeTenantId = (req.session as any).activeTenantId;
    const activeTenant = availableTenants.find(
      (t: AvailableTenant) => t.tenantId === activeTenantId
    );

    // Map tenant fields to match frontend interface (tenantId -> id, tenantType -> type)
    const mappedTenants = availableTenants.map((t: AvailableTenant) => ({
      id: t.tenantId,
      name: t.name,
      type: t.tenantType,
      role: t.role,
    }));

    const mappedActiveTenant = activeTenant
      ? {
          id: activeTenant.tenantId,
          name: activeTenant.name,
          type: activeTenant.tenantType,
          role: activeTenant.role,
        }
      : null;

    res.json({
      user: req.session.user,
      availableTenants: mappedTenants,
      activeTenant: mappedActiveTenant,
      githubAppInstallationUrl: config.github.appInstallationUrl,
    });
  } else {
    res.json({ user: null, githubAppInstallationUrl: config.github.appInstallationUrl });
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

// Setup endpoint for GitHub App installation
// Handles post-installation redirect from GitHub
// Creates organization tenant and links user to installation
authRouter.get('/setup', handleSetup);
