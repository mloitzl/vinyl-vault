// Setup endpoint handler for GitHub App installation flow
// Handles the redirect from GitHub after app installation
// Links authenticated user to installation and creates organization tenant

import { Request, Response } from 'express';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { queryBackend } from '../services/backendClient.js';
import { setActiveTenant } from '../types/session.js';
import { clearOnboardingCookie } from './cookies.js';

interface SetupQuery {
  installation_id?: string;
  setup_action?: string;
}

export async function handleSetup(req: Request, res: Response<any>): Promise<void> {
  const query = req.query as SetupQuery & { test_user_id?: string };
  const installationId = query.installation_id ? parseInt(query.installation_id, 10) : null;
  const setupAction = query.setup_action || 'install';

  // 1. Verify user is authenticated
  // In test mode (NODE_ENV=development), allow test_user_id to bypass auth
  const testUserId = process.env.NODE_ENV === 'development' ? query.test_user_id : undefined;
  const isTestMode = !!testUserId;

  if (!req.session.user && !isTestMode) {
    logger.info('Setup: User not authenticated, redirecting to login');
    // Clear any stale onboarding cookie before redirecting to login
    clearOnboardingCookie(res);
    res.redirect(`/auth/github?return_to=${encodeURIComponent(req.originalUrl)}`);
    return;
  }

  if (!installationId) {
    logger.warn('Setup: Missing installation_id parameter');
    // Clear onboarding cookie on error responses
    clearOnboardingCookie(res);
    res.status(400).json({
      error: 'Missing installation_id parameter',
      code: 'MISSING_INSTALLATION_ID',
    });
    return;
  }

  // For test mode, use test_user_id as userId
  const userId = isTestMode ? testUserId : req.session.user!.id;

  logger.info({ userId, installationId }, 'User setting up installation');

  try {
    // 2. Call backend mutation to complete installation setup
    // Backend will:
    // - Verify installation exists
    // - Link user to installation
    // - Create organization tenant
    // - Add user as ADMIN
    const mutation = `
      mutation CompleteInstallationSetup($input: CompleteInstallationSetupInput!) {
        completeInstallationSetup(input: $input) {
          ok
          tenantId
          tenantName
          message
        }
      }
    `;

    const result = await queryBackend<any>(mutation, {
      input: {
        userId,
        installationId,
        setupAction,
      },
    });

    if (result.errors) {
      logger.error({ errors: result.errors }, 'Setup: Backend error');
      const error = result.errors[0];
      // Clear onboarding cookie on error responses
      clearOnboardingCookie(res);
      res.status(400).json({
        error: error.message || 'Setup failed',
        code: 'SETUP_FAILED',
      });
      return;
    }

    const { tenantId, tenantName } = result.completeInstallationSetup || {};

    if (!tenantId) {
      logger.error('Setup: No tenant returned from backend');
      // Clear onboarding cookie on error responses
      clearOnboardingCookie(res);
      res.status(500).json({
        error: 'Failed to create organization tenant',
        code: 'TENANT_CREATION_FAILED',
      });
      return;
    }

    // 3. Update session with new tenant
    const currentTenants = ((req.session as any).availableTenants as any[]) || [];
    const newTenant = {
      tenantId,
      tenantType: 'ORGANIZATION',
      name: tenantName || tenantId,
      role: 'ADMIN',
    };

    // Avoid duplicates if already present
    const updatedTenants = [...currentTenants.filter((t) => t.tenantId !== tenantId), newTenant];

    (req.session as any).availableTenants = updatedTenants;
    setActiveTenant(req.session, tenantId);
    req.session.save((err) => {
      if (err) {
        logger.error({ err }, 'Setup: Session save error');
        clearOnboardingCookie(res);
        res.status(500).json({
          error: 'Session update failed',
          code: 'SESSION_ERROR',
        });
        return;
      }

      logger.info(
        { userId, installationId, tenantId },
        'Successfully linked user to installation and created org tenant'
      );

      // 4. Redirect to frontend with success message
      const redirectUrl = new URL(config.frontend.url);
      redirectUrl.searchParams.append('org_installed', tenantName || tenantId);
      redirectUrl.searchParams.append('installation_id', installationId.toString());

      res.redirect(redirectUrl.toString());
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Setup: Error completing installation setup');
    clearOnboardingCookie(res);
    res.status(500).json({
      error: error.message || 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}
