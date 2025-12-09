/**
 * Scoring Orchestrator
 *
 * Main entry point for the blended release lookup and scoring system.
 * Queries both Discogs and MusicBrainz in parallel, normalizes, scores,
 * and aggregates results into Album objects.
 *
 * Implements the complete pipeline for FR-NG-*, FR-SC-*, FR-AG-*, and QR-*.
 */

import type {
  RawRelease,
  ScoringConfig,
  ScoringDetail,
  LookupResult,
  Track,
} from './types.js';
import { getScoringConfig } from './config.js';
import { normalizeAndGroup } from './normalize.js';
import { scoreRelease } from './score.js';
import { createAlbums } from './aggregate.js';

// Import external API services
import * as discogs from '../discogs.js';
import * as musicbrainz from '../musicbrainz.js';

/**
 * Convert milliseconds to mm:ss duration string
 */
function msToDuration(ms: number | string): string {
  const n = Number(ms) || 0;
  const totalSec = Math.floor(n / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Fetch releases from MusicBrainz and convert to RawRelease format
 */
async function fetchMusicBrainzReleases(barcode: string): Promise<{
  releases: RawRelease[];
  errors: string[];
}> {
  const releases: RawRelease[] = [];
  const errors: string[] = [];

  try {
    const results = await musicbrainz.searchByBarcode(barcode);
    console.log(`MusicBrainz: found ${results.length} results for barcode ${barcode}`);

    for (const r of results) {
      const artist =
        Array.isArray(r['artist-credit']) && r['artist-credit'][0]
          ? r['artist-credit'][0].name
          : 'Unknown';
      const externalId = String(r.id);
      const source = 'MUSICBRAINZ' as const;
      const now = new Date().toISOString();

      // Attempt to fetch release details for genres/styles/trackList
      let genre: string[] = [];
      const trackList: Track[] = [];

      try {
        const details = await musicbrainz.getReleaseDetails(externalId);
        if (details) {
          // Extract genres from 'genres' or 'tags'
          if (Array.isArray(details.genres)) {
            genre = details.genres.map((g: any) => String(g.name));
          } else if (Array.isArray(details.tags)) {
            genre = details.tags.map((t: any) => String(t.name));
          }

          // Extract track list from media -> tracks
          if (Array.isArray(details.media)) {
            for (const media of details.media) {
              if (!Array.isArray(media.tracks)) continue;
              for (const t of media.tracks) {
                trackList.push({
                  position: t.position?.toString?.() ?? undefined,
                  title: t.title,
                  duration: t.length ? msToDuration(t.length) : undefined,
                });
              }
            }
          }
        }
      } catch (err: any) {
        // Non-fatal: continue with basic info
        console.warn('MusicBrainz details fetch failed:', err?.message ?? String(err));
      }

      releases.push({
        id: `${source}:${externalId}`,
        barcode,
        artist,
        title: r.title,
        year: r.date ? parseInt(String(r.date).slice(0, 4), 10) : null,
        format: undefined, // MusicBrainz doesn't provide format in search results
        genre,
        style: [], // MusicBrainz doesn't have styles
        label:
          Array.isArray(r['label-info']) && r['label-info'][0] && r['label-info'][0].label
            ? r['label-info'][0].label.name
            : undefined,
        country: r.country,
        coverImageUrl: undefined, // MusicBrainz doesn't provide cover images in API
        trackList,
        externalId,
        source,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err: any) {
    const errorMsg = `MusicBrainz error: ${err?.message ?? String(err)}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  return { releases, errors };
}

/**
 * Fetch releases from Discogs and convert to RawRelease format
 */
async function fetchDiscogsReleases(barcode: string): Promise<{
  releases: RawRelease[];
  errors: string[];
}> {
  const releases: RawRelease[] = [];
  const errors: string[] = [];

  try {
    const results = await discogs.searchByBarcode(barcode);
    console.log(`Discogs: found ${results.length} results for barcode ${barcode}`);

    for (const r of results) {
      const externalId = String(r.id);
      const source = 'DISCOGS' as const;
      const now = new Date().toISOString();

      // Try to fetch detailed release info
      let genre: string[] = [];
      let style: string[] = [];
      let trackList: Track[] = [];
      let catalogNumber: string | undefined;

      try {
        const details = await discogs.getReleaseDetails(externalId);
        if (details) {
          if (Array.isArray(details.genres)) {
            genre = details.genres.map((g: any) => String(g));
          }
          if (Array.isArray(details.styles)) {
            style = details.styles.map((s: any) => String(s));
          }
          if (Array.isArray(details.tracklist)) {
            trackList = details.tracklist.map((t: any) => ({
              position: t.position,
              title: t.title,
              duration: t.duration,
            }));
          }
          // Extract catalog number from labels
          if (Array.isArray(details.labels) && details.labels[0]) {
            catalogNumber = details.labels[0].catno;
          }
        }
      } catch (err: any) {
        // Non-fatal: continue with basic info
        console.warn('Discogs details fetch failed:', err?.message ?? String(err));
      }

      // Parse artist from Discogs "Artist - Title" format
      const titleParts = r.title?.split(' - ') || ['Unknown', 'Unknown'];
      const artist = titleParts[0] || 'Unknown';
      const title = titleParts.slice(1).join(' - ') || r.title || 'Unknown';

      releases.push({
        id: `${source}:${externalId}`,
        barcode,
        artist,
        title,
        year: r.year ? parseInt(String(r.year).slice(0, 4), 10) : null,
        format: Array.isArray(r.format) ? r.format.join(', ') : undefined,
        genre,
        style,
        label: Array.isArray(r.label) ? r.label.join(', ') : undefined,
        country: r.country,
        coverImageUrl: r.cover_image,
        trackList,
        externalId,
        source,
        catalogNumber,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err: any) {
    const errorMsg = `Discogs error: ${err?.message ?? String(err)}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  return { releases, errors };
}

/**
 * Fetch releases from all external APIs in parallel
 */
async function fetchAllReleases(barcode: string): Promise<{
  releases: RawRelease[];
  errors: string[];
}> {
  // Query both APIs in parallel
  const [mbResult, dgResult] = await Promise.all([
    fetchMusicBrainzReleases(barcode),
    fetchDiscogsReleases(barcode),
  ]);

  // Combine results
  const releases = [...mbResult.releases, ...dgResult.releases];
  const errors = [...mbResult.errors, ...dgResult.errors];

  console.log(`Total releases fetched: ${releases.length} (MB: ${mbResult.releases.length}, DG: ${dgResult.releases.length})`);

  return { releases, errors };
}

/**
 * Generate scoring details for all releases (QR-02 traceability)
 */
function generateScoringDetails(
  releases: RawRelease[],
  config: ScoringConfig
): ScoringDetail[] {
  // We need to normalize releases first to score them
  const groups = normalizeAndGroup(releases, config);
  const details: ScoringDetail[] = [];

  for (const group of groups) {
    for (const release of group.releases) {
      const result = scoreRelease(release, config);
      details.push({
        releaseId: result.releaseId,
        source: result.source,
        totalScore: result.totalScore,
        mediaTypeScore: result.breakdown.mediaType,
        countryScore: result.breakdown.country,
        completenessScore:
          result.breakdown.trackList +
          result.breakdown.coverArt +
          result.breakdown.labelInfo,
        appliedRules: result.appliedRules,
      });
    }
  }

  return details;
}

/**
 * Main orchestrator function: lookup barcode and return scored/aggregated albums
 *
 * This is the primary entry point for the blended scoring system.
 * It replaces the old fallback-based lookup with a parallel query
 * that scores and aggregates results from both Discogs and MusicBrainz.
 *
 * @param barcode - The barcode to look up
 * @param config - Optional scoring configuration (uses default if not provided)
 * @returns LookupResult with albums, raw releases, and scoring details
 */
export async function lookupAndScoreBarcode(
  barcode: string,
  config?: ScoringConfig
): Promise<LookupResult> {
  const startTime = Date.now();
  const cfg = config ?? getScoringConfig();

  // Validate input
  if (!barcode || barcode.trim() === '') {
    return {
      albums: [],
      rawReleases: [],
      fromCache: false,
      errors: ['Barcode is required'],
      scoringDetails: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  const errors: string[] = [];

  // Fetch from all external APIs in parallel
  const fetchResult = await fetchAllReleases(barcode);
  errors.push(...fetchResult.errors);

  const rawReleases = fetchResult.releases;

  // If no releases found, return early
  if (rawReleases.length === 0) {
    return {
      albums: [],
      rawReleases: [],
      fromCache: false,
      errors: errors.length > 0 ? errors : ['No releases found for this barcode'],
      scoringDetails: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Generate scoring details for traceability (QR-02)
  const scoringDetails = generateScoringDetails(rawReleases, cfg);

  // Normalize and group releases (FR-NG-1, FR-NG-2, FR-NG-3)
  const groups = normalizeAndGroup(rawReleases, cfg);
  console.log(`Created ${groups.length} album group(s) from ${rawReleases.length} releases`);

  // Create aggregated albums (FR-AG-1 through FR-AG-6)
  // This also handles scoring and primary release selection (FR-SC-*)
  const albums = createAlbums(groups, cfg);

  const processingTimeMs = Date.now() - startTime;
  console.log(`Barcode lookup completed in ${processingTimeMs}ms`);

  return {
    albums,
    rawReleases,
    fromCache: false,
    errors,
    scoringDetails,
    processingTimeMs,
  };
}

/**
 * Re-score existing raw releases with a different configuration
 * Useful for testing configuration changes without re-fetching from APIs
 *
 * @param rawReleases - Previously fetched raw releases
 * @param config - New scoring configuration to apply
 * @returns New LookupResult with re-scored albums
 */
export function rescoreReleases(
  rawReleases: RawRelease[],
  config?: ScoringConfig
): Omit<LookupResult, 'fromCache' | 'processingTimeMs'> {
  const startTime = Date.now();
  const cfg = config ?? getScoringConfig();

  if (rawReleases.length === 0) {
    return {
      albums: [],
      rawReleases: [],
      errors: ['No releases to score'],
      scoringDetails: [],
    };
  }

  // Generate new scoring details
  const scoringDetails = generateScoringDetails(rawReleases, cfg);

  // Normalize, group, and aggregate with new config
  const groups = normalizeAndGroup(rawReleases, cfg);
  const albums = createAlbums(groups, cfg);

  console.log(`Re-scored ${rawReleases.length} releases into ${albums.length} albums in ${Date.now() - startTime}ms`);

  return {
    albums,
    rawReleases,
    errors: [],
    scoringDetails,
  };
}
