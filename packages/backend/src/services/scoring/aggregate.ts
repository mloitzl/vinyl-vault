/**
 * Aggregation Module
 *
 * Implements album aggregation from grouped and scored releases.
 * Implements FR-AG-1, FR-AG-2, FR-AG-3, FR-AG-4, FR-AG-5, FR-AG-6 from Requirements.MD
 */

import { createHash } from 'crypto';
import type {
  NormalizedRelease,
  ReleaseGroup,
  Album,
  AlternativeRelease,
  Track,
  ScoringResult,
  ScoringConfig,
} from './types.js';
import { getScoringConfig } from './config.js';
import { selectPrimaryRelease } from './score.js';

/**
 * Generate a stable hash for the album ID
 *
 * @param input - String to hash
 * @returns Short hash string
 */
function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').substring(0, 12);
}

/**
 * Generate a unique album ID
 * Format: album:{barcode}:{hash(groupingKey)}
 *
 * @param barcode - The barcode
 * @param groupingKey - The grouping key
 * @returns Album ID
 */
export function generateAlbumId(barcode: string, groupingKey: string): string {
  return `album:${barcode}:${shortHash(groupingKey)}`;
}

/**
 * Select the best track list from available releases
 * Implements FR-AG-6
 *
 * Prefers:
 * 1. Primary release if it has a complete track list
 * 2. Most complete track list from any release
 * 3. Falls back to primary release's track list (even if incomplete)
 *
 * @param primary - The primary release
 * @param allReleases - All releases in the group
 * @param config - Scoring configuration
 * @returns Selected track list and its source
 */
export function selectBestTrackList(
  primary: NormalizedRelease,
  allReleases: NormalizedRelease[],
  config?: ScoringConfig
): { trackList: Track[]; source?: NormalizedRelease } {
  const cfg = config ?? getScoringConfig();
  const minTracks = cfg.minTracksForComplete;

  // Check if primary has a complete track list
  const primaryTracks = primary.trackList ?? [];
  if (primaryTracks.length >= minTracks) {
    return { trackList: primaryTracks, source: undefined }; // undefined means same as primary
  }

  // Find the most complete track list from all releases
  let bestRelease: NormalizedRelease | undefined;
  let bestTrackCount = primaryTracks.length;

  for (const release of allReleases) {
    const trackCount = release.trackList?.length ?? 0;

    // Only consider if source is trusted for track lists
    const sourceConfig =
      release.source === 'DISCOGS'
        ? cfg.sources.discogs
        : release.source === 'MUSICBRAINZ'
          ? cfg.sources.musicbrainz
          : null;

    if (sourceConfig && !sourceConfig.trustTrackList) {
      continue;
    }

    if (trackCount > bestTrackCount) {
      bestTrackCount = trackCount;
      bestRelease = release;
    }
  }

  if (bestRelease && bestRelease.id !== primary.id) {
    return {
      trackList: bestRelease.trackList ?? [],
      source: bestRelease,
    };
  }

  // Fall back to primary's track list
  return { trackList: primaryTracks, source: undefined };
}

/**
 * Aggregate genres from all releases, removing duplicates
 *
 * @param releases - All releases in the group
 * @returns Deduplicated array of genres
 */
export function aggregateGenres(releases: NormalizedRelease[]): string[] {
  const genreSet = new Set<string>();

  for (const release of releases) {
    for (const genre of release.genre ?? []) {
      // Normalize case for deduplication
      genreSet.add(genre.trim());
    }
  }

  // Sort for determinism (QR-01)
  return Array.from(genreSet).sort();
}

/**
 * Aggregate styles from all releases, removing duplicates
 *
 * @param releases - All releases in the group
 * @returns Deduplicated array of styles
 */
export function aggregateStyles(releases: NormalizedRelease[]): string[] {
  const styleSet = new Set<string>();

  for (const release of releases) {
    for (const style of release.style ?? []) {
      styleSet.add(style.trim());
    }
  }

  // Sort for determinism (QR-01)
  return Array.from(styleSet).sort();
}

/**
 * Collect external IDs by source
 * Implements FR-AG-3
 *
 * @param releases - All releases in the group
 * @returns Object with discogsIds and musicbrainzIds arrays
 */
export function collectExternalIds(releases: NormalizedRelease[]): {
  discogsIds: string[];
  musicbrainzIds: string[];
} {
  const discogsIds: string[] = [];
  const musicbrainzIds: string[] = [];

  for (const release of releases) {
    if (release.source === 'DISCOGS') {
      discogsIds.push(release.externalId);
    } else if (release.source === 'MUSICBRAINZ') {
      musicbrainzIds.push(release.externalId);
    }
  }

  // Sort for determinism (QR-01)
  return {
    discogsIds: discogsIds.sort(),
    musicbrainzIds: musicbrainzIds.sort(),
  };
}

/**
 * Create alternative release references for non-primary releases
 * Implements FR-AG-4
 *
 * @param primary - The primary release
 * @param allReleases - All releases in the group
 * @param allScores - Scoring results for all releases
 * @returns Array of alternative release references
 */
export function createAlternativeReleases(
  primary: NormalizedRelease,
  allReleases: NormalizedRelease[],
  allScores: ScoringResult[]
): AlternativeRelease[] {
  const alternatives: AlternativeRelease[] = [];

  for (let i = 0; i < allReleases.length; i++) {
    const release = allReleases[i];

    // Skip the primary release
    if (release.id === primary.id) {
      continue;
    }

    const score = allScores[i];

    alternatives.push({
      externalId: release.externalId,
      source: release.source,
      country: release.country,
      year: release.year,
      label: release.label,
      disambiguation: release.disambiguation,
      score: score.totalScore,
    });
  }

  // Sort by score descending for consistency (QR-01)
  return alternatives.sort((a, b) => b.score - a.score);
}

/**
 * Collect alternative titles from secondary releases
 * Implements FR-AG-5
 *
 * @param primary - The primary release
 * @param allReleases - All releases in the group
 * @returns Array of unique alternative titles
 */
export function collectOtherTitles(
  primary: NormalizedRelease,
  allReleases: NormalizedRelease[]
): string[] {
  const otherTitles = new Set<string>();
  const primaryTitleLower = primary.title.toLowerCase().trim();

  for (const release of allReleases) {
    if (release.id === primary.id) continue;

    const releaseTitleLower = release.title.toLowerCase().trim();

    // Only add if different from primary (case-insensitive comparison)
    if (releaseTitleLower !== primaryTitleLower) {
      otherTitles.add(release.title.trim());
    }
  }

  // Sort for determinism (QR-01)
  return Array.from(otherTitles).sort();
}

/**
 * Collect edition notes from releases
 * Implements FR-AG-5
 *
 * Extracts edition markers like "(Remastered)", "(Deluxe Edition)" etc.
 *
 * @param allReleases - All releases in the group
 * @returns Array of unique edition notes
 */
export function collectEditionNotes(allReleases: NormalizedRelease[]): string[] {
  const editionNotes = new Set<string>();

  // Common patterns for edition markers
  const editionPatterns = [
    /\(([^)]*(?:remaster|deluxe|special|expanded|anniversary|edition|version)[^)]*)\)/gi,
    /\[([^\]]*(?:remaster|deluxe|special|expanded|anniversary|edition|version)[^\]]*)\]/gi,
  ];

  for (const release of allReleases) {
    for (const pattern of editionPatterns) {
      const matches = release.title.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          editionNotes.add(match[1].trim());
        }
      }
    }

    // Also check disambiguation field (MusicBrainz)
    if (release.disambiguation) {
      editionNotes.add(release.disambiguation.trim());
    }
  }

  // Sort for determinism (QR-01)
  return Array.from(editionNotes).sort();
}

/**
 * Select the best cover image URL
 * Prefers primary release, falls back to any available cover
 *
 * @param primary - The primary release
 * @param allReleases - All releases in the group
 * @returns Best available cover URL or undefined
 */
export function selectBestCoverImage(
  primary: NormalizedRelease,
  allReleases: NormalizedRelease[]
): string | undefined {
  // Prefer primary release cover
  if (primary.coverImageUrl) {
    return primary.coverImageUrl;
  }

  // Fall back to first available cover from any release
  for (const release of allReleases) {
    if (release.coverImageUrl) {
      return release.coverImageUrl;
    }
  }

  return undefined;
}

/**
 * Create an Album object from a release group
 * Implements FR-AG-1, FR-AG-2
 *
 * @param group - The release group
 * @param config - Optional scoring configuration
 * @returns The aggregated Album object
 */
export function createAlbum(
  group: ReleaseGroup,
  config?: ScoringConfig
): Album {
  const cfg = config ?? getScoringConfig();

  // Select primary release (FR-SC-5)
  const { primary, primaryScore, allScores } = selectPrimaryRelease(group, cfg);

  // Generate album ID
  const id = generateAlbumId(group.barcode, group.groupingKey);

  // Select best track list (FR-AG-6)
  const trackListResult = selectBestTrackList(primary, group.releases, cfg);

  // Collect external IDs (FR-AG-3)
  const { discogsIds, musicbrainzIds } = collectExternalIds(group.releases);

  // Create alternative releases (FR-AG-4)
  const alternativeReleases = createAlternativeReleases(primary, group.releases, allScores);

  // Collect other titles and edition notes (FR-AG-5)
  const otherTitles = collectOtherTitles(primary, group.releases);
  const editionNotes = collectEditionNotes(group.releases);

  // Aggregate genres and styles
  const genres = aggregateGenres(group.releases);
  const styles = aggregateStyles(group.releases);

  // Select best cover image
  const coverImageUrl = selectBestCoverImage(primary, group.releases);

  const now = new Date().toISOString();

  // Build the Album object (FR-AG-1, FR-AG-2)
  const album: Album = {
    id,

    // Core attributes from primary release (FR-AG-2)
    title: primary.title,
    artist: primary.artist,
    year: primary.year,
    label: primary.label,
    format: primary.format,
    barcode: group.barcode,
    country: primary.country,
    coverImageUrl,

    // Track list (FR-AG-6)
    trackList: trackListResult.trackList,
    trackListSource: trackListResult.source?.source,

    // External identifiers (FR-AG-3)
    discogsIds,
    musicbrainzIds,

    // Alternative releases (FR-AG-4)
    alternativeReleases,

    // Collected alternatives (FR-AG-5)
    otherTitles,
    editionNotes,

    // Aggregated genres/styles
    genres,
    styles,

    // Scoring metadata (QR-02)
    primaryReleaseId: primary.id,
    primaryReleaseSource: primary.source,
    primaryReleaseScore: primaryScore.totalScore,

    // Timestamps
    createdAt: now,
    updatedAt: now,
  };

  return album;
}

/**
 * Create Album objects from multiple release groups
 *
 * @param groups - Array of release groups
 * @param config - Optional scoring configuration
 * @returns Array of Album objects
 */
export function createAlbums(
  groups: ReleaseGroup[],
  config?: ScoringConfig
): Album[] {
  const cfg = config ?? getScoringConfig();
  return groups.map((group) => createAlbum(group, cfg));
}

/**
 * Format an Album object for display/debugging
 *
 * @param album - The album to format
 * @returns Human-readable string
 */
export function formatAlbum(album: Album): string {
  const lines = [
    `Album: ${album.artist} - ${album.title}`,
    `  ID: ${album.id}`,
    `  Barcode: ${album.barcode}`,
    `  Year: ${album.year ?? 'Unknown'}`,
    `  Format: ${album.format ?? 'Unknown'}`,
    `  Label: ${album.label ?? 'Unknown'}`,
    `  Country: ${album.country ?? 'Unknown'}`,
    `  Cover: ${album.coverImageUrl ? 'Yes' : 'No'}`,
    `  Tracks: ${album.trackList.length}${album.trackListSource ? ` (from ${album.trackListSource})` : ''}`,
    `  Genres: ${album.genres.join(', ') || 'None'}`,
    `  Styles: ${album.styles.join(', ') || 'None'}`,
    `  Discogs IDs: ${album.discogsIds.join(', ') || 'None'}`,
    `  MusicBrainz IDs: ${album.musicbrainzIds.join(', ') || 'None'}`,
    `  Alternative Releases: ${album.alternativeReleases.length}`,
    `  Other Titles: ${album.otherTitles.join('; ') || 'None'}`,
    `  Edition Notes: ${album.editionNotes.join('; ') || 'None'}`,
    `  Primary Release: ${album.primaryReleaseId} (${album.primaryReleaseSource}, score: ${album.primaryReleaseScore})`,
  ];

  return lines.join('\n');
}
