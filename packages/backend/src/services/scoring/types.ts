/**
 * Scoring Module Types
 *
 * Type definitions for the release normalization, scoring, and aggregation system.
 * Implements requirements FR-NG-*, FR-SC-*, FR-AG-*, and QR-* from Requirements.MD
 */

// =============================================================================
// Source Types (from external APIs)
// =============================================================================

/**
 * The source of a release (external API or manual entry)
 */
export type ReleaseSource = 'DISCOGS' | 'MUSICBRAINZ' | 'MANUAL';

/**
 * A track from a release's track list
 */
export interface Track {
  position?: string;
  title: string;
  duration?: string;
}

/**
 * Raw release data as returned from Discogs or MusicBrainz APIs
 * before any normalization or scoring
 */
export interface RawRelease {
  /** Composite ID: `${source}‡${externalId}` */
  id: string;
  /** The barcode used to find this release */
  barcode: string;
  /** Artist name (may need parsing from "Artist - Title" format) */
  artist: string;
  /** Album/release title */
  title: string;
  /** Release year (4-digit) */
  year: number | null;
  /** Format string (e.g., "Vinyl, LP, Album") */
  format?: string;
  /** Genre tags */
  genre: string[];
  /** Style tags (Discogs-specific, more granular than genre) */
  style: string[];
  /** Record label */
  label?: string;
  /** Release country (ISO code or full name) */
  country?: string;
  /** URL to cover art image */
  coverImageUrl?: string;
  /** Track listing */
  trackList: Track[];
  /** External ID from the source API */
  externalId: string;
  /** Which API this release came from */
  source: ReleaseSource;
  /** Catalog number (if available) */
  catalogNumber?: string;
  /** Disambiguation text (MusicBrainz-specific) */
  disambiguation?: string;
  /** ISO timestamp */
  createdAt: string;
  /** ISO timestamp */
  updatedAt: string;
}

// =============================================================================
// Normalization Types (FR-NG-*)
// =============================================================================

/**
 * A release after normalization, with grouping key calculated
 * Implements FR-NG-1 and FR-NG-2
 */
export interface NormalizedRelease extends RawRelease {
  /** Normalized artist name (lowercase, trimmed, affixes removed) */
  normalizedArtist: string;
  /** Normalized title (lowercase, trimmed, affixes removed) */
  normalizedTitle: string;
  /**
   * Grouping key for album candidate grouping
   * Format: `${barcode}|${normalizedArtist}|${normalizedTitle}`
   */
  groupingKey: string;
}

/**
 * A group of releases that represent the same album
 * Implements FR-NG-2
 */
export interface ReleaseGroup {
  /** The grouping key shared by all releases in this group */
  groupingKey: string;
  /** The barcode (same for all releases in group) */
  barcode: string;
  /** Normalized artist (same for all releases in group) */
  normalizedArtist: string;
  /** Normalized title (same for all releases in group) */
  normalizedTitle: string;
  /** All releases in this group */
  releases: NormalizedRelease[];
}

// =============================================================================
// Scoring Types (FR-SC-*)
// =============================================================================

/**
 * Breakdown of how a release's score was calculated
 * Implements QR-02 (Traceability of decisions)
 */
export interface ScoreBreakdown {
  /** Score from media type matching (FR-SC-2) */
  mediaType: number;
  /** Score from country preference (FR-SC-3) */
  country: number;
  /** Score from track list completeness (FR-SC-4a) */
  trackList: number;
  /** Score from cover art availability (FR-SC-4b) */
  coverArt: number;
  /** Score from label/catalog info (FR-SC-4c) */
  labelInfo: number;
  /** Source-specific bonus/penalty */
  sourceBonus: number;
}

/**
 * Complete scoring result for a single release
 * Implements FR-SC-1 and QR-02
 */
export interface ScoringResult {
  /** The release ID that was scored */
  releaseId: string;
  /** The source of the release */
  source: ReleaseSource;
  /** Total calculated score */
  totalScore: number;
  /** Detailed breakdown of score components */
  breakdown: ScoreBreakdown;
  /** Human-readable list of rules that were applied */
  appliedRules: string[];
}

// =============================================================================
// Aggregation Types (FR-AG-*)
// =============================================================================

/**
 * Reference to an alternative (non-primary) release
 * Implements FR-AG-4
 */
export interface AlternativeRelease {
  /** External ID from the source */
  externalId: string;
  /** Which API this release came from */
  source: ReleaseSource;
  /** Release country */
  country?: string;
  /** Release year */
  year?: number | null;
  /** Record label */
  label?: string;
  /** Disambiguation comment if provided */
  disambiguation?: string;
  /** The score this release received */
  score: number;
}

/**
 * The final aggregated Album object
 * Implements FR-AG-1 through FR-AG-6
 */
export interface Album {
  /**
   * Unique ID for this album
   * Format: `album:${barcode}:${hash(groupingKey)}`
   */
  id: string;

  // Core attributes from primary release (FR-AG-2)
  /** Album title from primary release */
  title: string;
  /** Main artist from primary release */
  artist: string;
  /** Release year from primary release */
  year: number | null;
  /** Record label from primary release */
  label?: string;
  /** Primary format (e.g., "Vinyl, LP") */
  format?: string;
  /** The barcode used to find this album */
  barcode: string;
  /** Release country from primary release */
  country?: string;
  /** Cover art URL from primary release (or best available) */
  coverImageUrl?: string;

  // Track list (FR-AG-6)
  /** Canonical track list (from most complete source) */
  trackList: Track[];
  /** Source of the track list if different from primary */
  trackListSource?: ReleaseSource;

  // External identifiers (FR-AG-3)
  /** All Discogs release IDs in this group */
  discogsIds: string[];
  /** All MusicBrainz release IDs (MBIDs) in this group */
  musicbrainzIds: string[];

  // Alternative releases (FR-AG-4)
  /** Non-primary releases in this group */
  alternativeReleases: AlternativeRelease[];

  // Collected alternatives (FR-AG-5)
  /** Alternative titles from secondary releases */
  otherTitles: string[];
  /** Edition notes from secondary releases */
  editionNotes: string[];

  // Genre/style aggregated from all sources
  /** Combined genres from all releases */
  genres: string[];
  /** Combined styles from all releases */
  styles: string[];

  // Scoring metadata (QR-02)
  /** ID of the release selected as primary */
  primaryReleaseId: string;
  /** Source of the primary release */
  primaryReleaseSource: ReleaseSource;
  /** Score of the primary release */
  primaryReleaseScore: number;

  // Timestamps
  /** ISO timestamp when this album was created */
  createdAt: string;
  /** ISO timestamp when this album was last updated */
  updatedAt: string;
}

// =============================================================================
// Configuration Types (FR-CF-*)
// =============================================================================

/**
 * Weights for different scoring components
 * Implements FR-CF-1
 */
export interface ScoringWeights {
  /** Weight for media type match (FR-SC-2) */
  mediaType: number;
  /** Weight for preferred country (FR-SC-3) */
  preferredCountry: number;
  /** Penalty for de-prioritized country (FR-SC-3) */
  deprioritizedCountry: number;
  /** Weight for complete track list (FR-SC-4a) */
  trackListComplete: number;
  /** Weight for partial track list */
  trackListPartial: number;
  /** Weight for cover art presence (FR-SC-4b) */
  coverArt: number;
  /** Weight for label info presence (FR-SC-4c) */
  labelInfo: number;
  /** Weight for catalog number presence (FR-SC-4c) */
  catalogNumber: number;
}

/**
 * Source-specific configuration
 * Implements FR-CF-3
 */
export interface SourceConfig {
  /** Bonus/penalty applied to all releases from this source */
  baseScore: number;
  /** Additional affixes to remove for this source only */
  additionalAffixes?: string[];
  /** Whether to trust this source's track list */
  trustTrackList: boolean;
}

/**
 * Complete scoring configuration
 * Implements FR-CF-1, FR-CF-2, FR-CF-3
 */
export interface ScoringConfig {
  /** Scoring weights for different factors */
  weights: ScoringWeights;

  /**
   * Preferred media type keywords (FR-SC-2)
   * Releases with formats containing these keywords get bonus points
   */
  preferredMediaTypes: string[];

  /**
   * Preferred countries (FR-SC-3)
   * Releases from these countries get bonus points
   */
  preferredCountries: string[];

  /**
   * De-prioritized countries (FR-SC-3)
   * Releases from these countries get penalty points
   */
  deprioritizedCountries: string[];

  /**
   * Non-semantic affixes to remove during normalization (FR-CF-2)
   * e.g., "(Remastered)", "(Deluxe Edition)"
   */
  normalizationAffixes: string[];

  /**
   * Source-specific configuration (FR-CF-3)
   */
  sources: {
    discogs: SourceConfig;
    musicbrainz: SourceConfig;
  };

  /**
   * Minimum number of tracks to consider a track list "complete"
   */
  minTracksForComplete: number;

  /**
   * Tie-breaking preference when scores are equal (FR-SC-5)
   * 'earliestYear' | 'smallestId' | 'preferDiscogs' | 'preferMusicBrainz'
   */
  tieBreaker: 'earliestYear' | 'smallestId' | 'preferDiscogs' | 'preferMusicBrainz';
}

// =============================================================================
// Lookup Result Types
// =============================================================================

/**
 * Detailed scoring information for a single release
 * Used for traceability (QR-02)
 */
export interface ScoringDetail {
  releaseId: string;
  source: ReleaseSource;
  totalScore: number;
  mediaTypeScore: number;
  countryScore: number;
  completenessScore: number;
  appliedRules: string[];
}

/**
 * Result of a barcode lookup operation
 */
export interface LookupResult {
  /** Aggregated albums (primary output) */
  albums: Album[];
  /** Raw releases before aggregation (for debugging/re-scoring) */
  rawReleases: RawRelease[];
  /** Whether results came from cache */
  fromCache: boolean;
  /** Any errors encountered during lookup */
  errors: string[];
  /** Detailed scoring information (QR-02) */
  scoringDetails: ScoringDetail[];
  /** Time taken for the lookup in milliseconds (QR-03) */
  processingTimeMs: number;
}
