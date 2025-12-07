/**
 * Scoring Configuration
 *
 * Loads and manages scoring configuration for release normalization and aggregation.
 * Implements FR-CF-1, FR-CF-2, FR-CF-3 from Requirements.MD
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { ScoringConfig } from './types.js';
import { config } from '../../config/index.js';

// Get the directory of this file for resolving config path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default scoring configuration
 * These values are used if no external config file is provided
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: {
    // Media type matching (FR-SC-2)
    mediaType: 20,

    // Country preference (FR-SC-3)
    preferredCountry: 15,
    deprioritizedCountry: -10,

    // Metadata completeness (FR-SC-4)
    trackListComplete: 25,
    trackListPartial: 10,
    coverArt: 15,
    labelInfo: 10,
    catalogNumber: 5,
  },

  // Preferred media types - vinyl-focused (FR-SC-2)
  preferredMediaTypes: ['vinyl', 'lp', '12"', '10"', '7"', 'album'],

  // Preferred countries (FR-SC-3)
  preferredCountries: [
    'US',
    'USA',
    'United States',
    'UK',
    'United Kingdom',
    'GB',
    'AT',
    'Austria',
    'DE',
    'Germany',
  ],

  // De-prioritized countries (FR-SC-3)
  deprioritizedCountries: ['RU', 'Russia', 'CN', 'China'],

  // Non-semantic affixes to remove during normalization (FR-CF-2)
  normalizationAffixes: [
    // Remaster variants
    '(remastered)',
    '(remaster)',
    '[remastered]',
    '[remaster]',
    '- remastered',
    '- remaster',

    // Deluxe/Special editions
    '(deluxe)',
    '(deluxe edition)',
    '(deluxe version)',
    '[deluxe]',
    '[deluxe edition]',
    '(special edition)',
    '[special edition]',
    '(expanded edition)',
    '[expanded edition]',
    '(anniversary edition)',
    '[anniversary edition]',

    // Format indicators
    '(vinyl)',
    '[vinyl]',
    '(lp)',
    '[lp]',
    '(album)',
    '[album]',

    // Year editions
    '(2023 remaster)',
    '(2022 remaster)',
    '(2021 remaster)',
    '(2020 remaster)',
    '(2019 remaster)',
    '(2018 remaster)',
    '(2017 remaster)',

    // Common suffixes
    '(bonus tracks)',
    '[bonus tracks]',
    '(with bonus tracks)',
    '(bonus track version)',
  ],

  // Source-specific configuration (FR-CF-3)
  sources: {
    discogs: {
      // Discogs often has better vinyl-specific metadata
      baseScore: 5,
      trustTrackList: true,
      additionalAffixes: [
        // Discogs-specific patterns
        '(promo)',
        '[promo]',
        '(test pressing)',
        '(white label)',
      ],
    },
    musicbrainz: {
      // MusicBrainz has good general metadata
      baseScore: 0,
      trustTrackList: true,
      additionalAffixes: [
        // MusicBrainz-specific patterns
        '(disambiguation)',
      ],
    },
  },

  // Track list completeness threshold
  minTracksForComplete: 4,

  // Tie-breaking strategy (FR-SC-5)
  tieBreaker: 'earliestYear',
};

/**
 * Cached configuration instance
 */
let cachedConfig: ScoringConfig | null = null;

/**
 * Get the path to the external config file
 */
function getConfigFilePath(): string {
  // Check environment variable first
  if (config.scoring.configPath) {
    return config.scoring.configPath;
  }

  // Default to packages/backend/config/scoring.json
  return resolve(__dirname, '../../../config/scoring.json');
}

/**
 * Deep merge two objects, with source values overriding target values
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(target[key], source[key] as any);
      } else {
        // Override with source value
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}

/**
 * Load scoring configuration from file
 * Merges with defaults so partial configs are supported
 */
function loadConfigFromFile(): Partial<ScoringConfig> | null {
  const configPath = getConfigFilePath();

  if (!existsSync(configPath)) {
    console.log(`Scoring config file not found at ${configPath}, using defaults`);
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    console.log(`Loaded scoring config from ${configPath}`);
    return parsed;
  } catch (err: any) {
    console.warn(`Failed to load scoring config from ${configPath}: ${err?.message}`);
    return null;
  }
}

/**
 * Get the scoring configuration
 * Loads from file if available, otherwise uses defaults
 * Configuration is cached after first load
 *
 * @param forceReload - Force reload from file (bypass cache)
 */
export function getScoringConfig(forceReload = false): ScoringConfig {
  if (cachedConfig && !forceReload) {
    return cachedConfig;
  }

  const fileConfig = loadConfigFromFile();

  if (fileConfig) {
    cachedConfig = deepMerge(DEFAULT_SCORING_CONFIG, fileConfig);
  } else {
    cachedConfig = { ...DEFAULT_SCORING_CONFIG };
  }

  return cachedConfig;
}

/**
 * Override the cached configuration (useful for testing)
 */
export function setScoringConfig(config: ScoringConfig): void {
  cachedConfig = config;
}

/**
 * Clear the cached configuration (forces reload on next access)
 */
export function clearScoringConfigCache(): void {
  cachedConfig = null;
}

/**
 * Validate a scoring configuration object
 * Returns an array of validation errors (empty if valid)
 */
export function validateScoringConfig(config: unknown): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('Configuration must be an object');
    return errors;
  }

  const cfg = config as Record<string, unknown>;

  // Validate weights
  if (cfg.weights) {
    if (typeof cfg.weights !== 'object') {
      errors.push('weights must be an object');
    } else {
      const weights = cfg.weights as Record<string, unknown>;
      const expectedWeightKeys = [
        'mediaType',
        'preferredCountry',
        'deprioritizedCountry',
        'trackListComplete',
        'trackListPartial',
        'coverArt',
        'labelInfo',
        'catalogNumber',
      ];
      for (const key of expectedWeightKeys) {
        if (weights[key] !== undefined && typeof weights[key] !== 'number') {
          errors.push(`weights.${key} must be a number`);
        }
      }
    }
  }

  // Validate arrays
  const arrayFields = [
    'preferredMediaTypes',
    'preferredCountries',
    'deprioritizedCountries',
    'normalizationAffixes',
  ];
  for (const field of arrayFields) {
    if (cfg[field] !== undefined) {
      if (!Array.isArray(cfg[field])) {
        errors.push(`${field} must be an array`);
      } else if (!(cfg[field] as unknown[]).every((item) => typeof item === 'string')) {
        errors.push(`${field} must contain only strings`);
      }
    }
  }

  // Validate sources
  if (cfg.sources) {
    if (typeof cfg.sources !== 'object') {
      errors.push('sources must be an object');
    } else {
      const sources = cfg.sources as Record<string, unknown>;
      for (const sourceName of ['discogs', 'musicbrainz']) {
        if (sources[sourceName]) {
          const source = sources[sourceName] as Record<string, unknown>;
          if (source.baseScore !== undefined && typeof source.baseScore !== 'number') {
            errors.push(`sources.${sourceName}.baseScore must be a number`);
          }
          if (source.trustTrackList !== undefined && typeof source.trustTrackList !== 'boolean') {
            errors.push(`sources.${sourceName}.trustTrackList must be a boolean`);
          }
        }
      }
    }
  }

  // Validate tieBreaker
  if (cfg.tieBreaker !== undefined) {
    const validTieBreakers = ['earliestYear', 'smallestId', 'preferDiscogs', 'preferMusicBrainz'];
    if (!validTieBreakers.includes(cfg.tieBreaker as string)) {
      errors.push(`tieBreaker must be one of: ${validTieBreakers.join(', ')}`);
    }
  }

  // Validate minTracksForComplete
  if (cfg.minTracksForComplete !== undefined) {
    if (typeof cfg.minTracksForComplete !== 'number' || cfg.minTracksForComplete < 1) {
      errors.push('minTracksForComplete must be a positive number');
    }
  }

  return errors;
}
