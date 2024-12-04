/**
 * Normalization Module
 *
 * Implements text normalization and release grouping for the scoring system.
 * Implements FR-NG-1, FR-NG-2, FR-NG-3 from Requirements.MD
 */

import type {
  RawRelease,
  NormalizedRelease,
  ReleaseGroup,
  ScoringConfig,
  ReleaseSource,
} from './types.js';
import { getScoringConfig } from './config.js';

/**
 * Normalize a text string for grouping purposes
 * Implements FR-NG-1:
 *   a) Convert to lowercase
 *   b) Remove leading/trailing whitespace
 *   c) Remove non-semantic affixes (configurable)
 *
 * Also removes common leading articles ("The ", "A ", "An ") for better grouping.
 *
 * @param text - The text to normalize
 * @param affixes - List of affixes to remove (case-insensitive)
 * @returns Normalized text
 */
export function normalizeText(text: string, affixes: string[]): string {
  if (!text) return '';

  // a) Convert to lowercase
  let normalized = text.toLowerCase();

  // b) Remove leading/trailing whitespace
  normalized = normalized.trim();

  // c) Remove non-semantic affixes
  // Sort affixes by length (longest first) to avoid partial matches
  const sortedAffixes = [...affixes].sort((a, b) => b.length - a.length);

  for (const affix of sortedAffixes) {
    const affixLower = affix.toLowerCase();
    // Remove affix wherever it appears (could be at end, middle with spaces, etc.)
    // Use a loop to remove multiple occurrences
    let prevLength: number;
    do {
      prevLength = normalized.length;
      normalized = normalized.replace(affixLower, '');
    } while (normalized.length < prevLength);
  }

  // Clean up any double spaces left after affix removal
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Remove trailing punctuation that might be left after affix removal
  normalized = normalized.replace(/[\s\-:,]+$/, '').trim();

  // Remove common leading articles for better grouping
  // "The Dark Side" and "Dark Side" should group together
  normalized = normalized.replace(/^(the|a|an)\s+/i, '');

  return normalized;
}

/**
 * Extract the main artist from various formats
 *
 * Handles:
 * - Discogs format: "Artist Name - Album Title" → "Artist Name"
 * - Simple artist name
 * - Multiple artists (takes first/primary)
 *
 * @param artist - Artist string from release
 * @param title - Title string (for Discogs combined format detection)
 * @returns Extracted artist name
 */
export function extractMainArtist(artist: string, title?: string): string {
  if (!artist) return 'unknown';

  // Check if this is a Discogs-style "Artist - Title" combined string
  // Only split if the title is also present in the artist field
  if (title && artist.includes(' - ')) {
    const parts = artist.split(' - ');
    if (parts.length >= 2) {
      const potentialTitle = parts.slice(1).join(' - ').toLowerCase();
      const titleLower = title.toLowerCase();
      // If the second part looks like the title, extract just the artist
      if (potentialTitle.includes(titleLower) || titleLower.includes(potentialTitle)) {
        return parts[0].trim();
      }
    }
  }

  // Handle "Artist1, Artist2" or "Artist1 & Artist2" - take the first
  let mainArtist = artist;

  // Split on common separators but keep the first part
  const separators = [' feat. ', ' feat ', ' ft. ', ' ft ', ' featuring ', ' vs. ', ' vs ', ' and ', ' & ', ', '];
  for (const sep of separators) {
    const sepLower = sep.toLowerCase();
    const artistLower = mainArtist.toLowerCase();
    const idx = artistLower.indexOf(sepLower);
    if (idx > 0) {
      mainArtist = mainArtist.substring(0, idx);
      break; // Only split on first separator found
    }
  }

  return mainArtist.trim();
}

/**
 * Create a grouping key for a release
 * Implements FR-NG-2:
 *   a) Scanned barcode
 *   b) Normalized album title
 *   c) Normalized main artist
 *
 * @param barcode - The barcode
 * @param normalizedTitle - The normalized title
 * @param normalizedArtist - The normalized artist
 * @returns Grouping key string
 */
export function createGroupingKey(
  barcode: string,
  normalizedTitle: string,
  normalizedArtist: string
): string {
  // Use pipe as separator (unlikely to appear in normalized text)
  return `${barcode}|${normalizedArtist}|${normalizedTitle}`;
}

/**
 * Get all affixes for a specific source
 * Combines global affixes with source-specific ones
 *
 * @param config - Scoring configuration
 * @param source - Release source
 * @returns Combined list of affixes
 */
export function getAffixesForSource(config: ScoringConfig, source: ReleaseSource): string[] {
  const globalAffixes = config.normalizationAffixes;

  if (source === 'DISCOGS' && config.sources.discogs.additionalAffixes) {
    return [...globalAffixes, ...config.sources.discogs.additionalAffixes];
  }

  if (source === 'MUSICBRAINZ' && config.sources.musicbrainz.additionalAffixes) {
    return [...globalAffixes, ...config.sources.musicbrainz.additionalAffixes];
  }

  return globalAffixes;
}

/**
 * Normalize a single release
 * Adds normalized fields and grouping key
 *
 * @param release - Raw release data
 * @param config - Optional scoring configuration (uses default if not provided)
 * @returns Normalized release
 */
export function normalizeRelease(
  release: RawRelease,
  config?: ScoringConfig
): NormalizedRelease {
  const cfg = config ?? getScoringConfig();
  const affixes = getAffixesForSource(cfg, release.source);

  // Extract and normalize the main artist
  const mainArtist = extractMainArtist(release.artist, release.title);
  const normalizedArtist = normalizeText(mainArtist, affixes);

  // Normalize the title
  const normalizedTitle = normalizeText(release.title, affixes);

  // Create grouping key
  const groupingKey = createGroupingKey(release.barcode, normalizedTitle, normalizedArtist);

  return {
    ...release,
    normalizedArtist,
    normalizedTitle,
    groupingKey,
  };
}

/**
 * Normalize multiple releases
 *
 * @param releases - Array of raw releases
 * @param config - Optional scoring configuration
 * @returns Array of normalized releases
 */
export function normalizeReleases(
  releases: RawRelease[],
  config?: ScoringConfig
): NormalizedRelease[] {
  const cfg = config ?? getScoringConfig();
  return releases.map((r) => normalizeRelease(r, cfg));
}

/**
 * Group normalized releases by their grouping key
 * Implements FR-NG-2
 *
 * @param releases - Array of normalized releases
 * @returns Array of release groups
 */
export function groupReleases(releases: NormalizedRelease[]): ReleaseGroup[] {
  // Group by grouping key
  const groupMap = new Map<string, NormalizedRelease[]>();

  for (const release of releases) {
    const existing = groupMap.get(release.groupingKey);
    if (existing) {
      existing.push(release);
    } else {
      groupMap.set(release.groupingKey, [release]);
    }
  }

  // Convert to ReleaseGroup objects
  const groups: ReleaseGroup[] = [];

  for (const [groupingKey, groupReleases] of groupMap) {
    // All releases in a group share the same barcode, normalizedArtist, normalizedTitle
    const first = groupReleases[0];
    groups.push({
      groupingKey,
      barcode: first.barcode,
      normalizedArtist: first.normalizedArtist,
      normalizedTitle: first.normalizedTitle,
      releases: groupReleases,
    });
  }

  return groups;
}

/**
 * Check if a group has a unique release (FR-NG-3)
 * If so, no further disambiguation is needed
 *
 * @param group - Release group
 * @returns True if the group contains exactly one release
 */
export function isUniqueRelease(group: ReleaseGroup): boolean {
  return group.releases.length === 1;
}

/**
 * Complete normalization pipeline:
 * 1. Normalize all releases
 * 2. Group by (barcode, normalizedTitle, normalizedArtist)
 *
 * @param releases - Array of raw releases
 * @param config - Optional scoring configuration
 * @returns Array of release groups
 */
export function normalizeAndGroup(
  releases: RawRelease[],
  config?: ScoringConfig
): ReleaseGroup[] {
  const normalized = normalizeReleases(releases, config);
  return groupReleases(normalized);
}
