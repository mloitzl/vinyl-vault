// Feature flags utility
// Centralized feature flag management for the BFF

import { config } from '../config/env.js';

/**
 * Feature flags available to the frontend
 */
export interface FeatureFlags {
  enableTenantFeatures: boolean;
}

/**
 * Get the current feature flags based on configuration
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    enableTenantFeatures: config.features.enableTenantFeatures,
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(featureName: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[featureName];
}
