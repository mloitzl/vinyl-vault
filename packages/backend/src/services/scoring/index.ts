/**
 * Scoring Module
 *
 * Exports for release normalization, scoring, and aggregation.
 * Implements FR-NG-*, FR-SC-*, FR-AG-*, FR-CF-*, and QR-* from Requirements.MD
 */

// Types
export type {
  ReleaseSource,
  Track,
  RawRelease,
  NormalizedRelease,
  ReleaseGroup,
  ScoreBreakdown,
  ScoringResult,
  AlternativeRelease,
  Album,
  ScoringWeights,
  SourceConfig,
  ScoringConfig,
  ScoringDetail,
  LookupResult,
} from './types.js';

// Configuration
export {
  DEFAULT_SCORING_CONFIG,
  getScoringConfig,
  setScoringConfig,
  clearScoringConfigCache,
  validateScoringConfig,
} from './config.js';

// Normalization (FR-NG-1, FR-NG-2, FR-NG-3)
export {
  normalizeText,
  extractMainArtist,
  createGroupingKey,
  getAffixesForSource,
  normalizeRelease,
  normalizeReleases,
  groupReleases,
  isUniqueRelease,
  normalizeAndGroup,
} from './normalize.js';

// TODO: Phase 3 - Scoring
// export { scoreRelease, selectPrimaryRelease } from './score.js';

// TODO: Phase 4 - Aggregation
// export { createAlbum, selectBestTrackList, aggregateGenresAndStyles } from './aggregate.js';

// TODO: Phase 5 - Orchestrator
// export { lookupAndScoreBarcode } from './orchestrator.js';
