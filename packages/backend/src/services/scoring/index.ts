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

// TODO: Phase 2 - Normalization
// export { normalizeText, normalizeRelease, createGroupingKey, groupReleases } from './normalize.js';

// TODO: Phase 3 - Scoring
// export { scoreRelease, selectPrimaryRelease } from './score.js';

// TODO: Phase 4 - Aggregation
// export { createAlbum, selectBestTrackList, aggregateGenresAndStyles } from './aggregate.js';

// TODO: Phase 5 - Orchestrator
// export { lookupAndScoreBarcode } from './orchestrator.js';
