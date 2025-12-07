/**
 * Scoring Module
 *
 * Implements release scoring for primary release selection.
 * Implements FR-SC-1, FR-SC-2, FR-SC-3, FR-SC-4, FR-SC-5 from Requirements.MD
 * Implements QR-01 (Determinism) and QR-02 (Traceability)
 */

import type {
  NormalizedRelease,
  ReleaseGroup,
  ScoringConfig,
  ScoringResult,
  ScoreBreakdown,
  ReleaseSource,
} from './types.js';
import { getScoringConfig } from './config.js';

/**
 * Score a release based on media type preference
 * Implements FR-SC-2
 *
 * @param release - The release to score
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreMediaType(
  release: NormalizedRelease,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  if (!release.format) {
    rules.push('No format information available');
    return { score, rules };
  }

  const formatLower = release.format.toLowerCase();

  // Check each preferred media type
  for (const mediaType of config.preferredMediaTypes) {
    const mediaTypeLower = mediaType.toLowerCase();
    if (formatLower.includes(mediaTypeLower)) {
      score = config.weights.mediaType;
      rules.push(`Format "${release.format}" matches preferred type "${mediaType}" (+${config.weights.mediaType})`);
      break; // Only count once even if multiple matches
    }
  }

  if (score === 0) {
    rules.push(`Format "${release.format}" does not match any preferred media type`);
  }

  return { score, rules };
}

/**
 * Score a release based on country preference
 * Implements FR-SC-3
 *
 * @param release - The release to score
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreCountry(
  release: NormalizedRelease,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  if (!release.country) {
    rules.push('No country information available');
    return { score, rules };
  }

  const countryLower = release.country.toLowerCase();

  // Check preferred countries
  for (const preferred of config.preferredCountries) {
    if (countryLower === preferred.toLowerCase()) {
      score = config.weights.preferredCountry;
      rules.push(`Country "${release.country}" is preferred (+${config.weights.preferredCountry})`);
      return { score, rules };
    }
  }

  // Check de-prioritized countries
  for (const deprioritized of config.deprioritizedCountries) {
    if (countryLower === deprioritized.toLowerCase()) {
      score = config.weights.deprioritizedCountry;
      rules.push(`Country "${release.country}" is de-prioritized (${config.weights.deprioritizedCountry})`);
      return { score, rules };
    }
  }

  rules.push(`Country "${release.country}" is neutral (no bonus/penalty)`);
  return { score, rules };
}

/**
 * Score a release based on track list completeness
 * Implements FR-SC-4a
 *
 * @param release - The release to score
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreTrackList(
  release: NormalizedRelease,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  const trackCount = release.trackList?.length ?? 0;

  if (trackCount === 0) {
    rules.push('No track list available');
    return { score, rules };
  }

  if (trackCount >= config.minTracksForComplete) {
    score = config.weights.trackListComplete;
    rules.push(`Complete track list (${trackCount} tracks >= ${config.minTracksForComplete}) (+${config.weights.trackListComplete})`);
  } else {
    score = config.weights.trackListPartial;
    rules.push(`Partial track list (${trackCount} tracks < ${config.minTracksForComplete}) (+${config.weights.trackListPartial})`);
  }

  return { score, rules };
}

/**
 * Score a release based on cover art availability
 * Implements FR-SC-4b
 *
 * @param release - The release to score
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreCoverArt(
  release: NormalizedRelease,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  if (release.coverImageUrl) {
    score = config.weights.coverArt;
    rules.push(`Cover art available (+${config.weights.coverArt})`);
  } else {
    rules.push('No cover art available');
  }

  return { score, rules };
}

/**
 * Score a release based on label/catalog information
 * Implements FR-SC-4c
 *
 * @param release - The release to score
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreLabelInfo(
  release: NormalizedRelease,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  if (release.label) {
    score += config.weights.labelInfo;
    rules.push(`Label information available: "${release.label}" (+${config.weights.labelInfo})`);
  } else {
    rules.push('No label information available');
  }

  if (release.catalogNumber) {
    score += config.weights.catalogNumber;
    rules.push(`Catalog number available: "${release.catalogNumber}" (+${config.weights.catalogNumber})`);
  }

  return { score, rules };
}

/**
 * Get the source-specific base score
 * Implements FR-CF-3
 *
 * @param source - The release source
 * @param config - Scoring configuration
 * @returns Score and applied rules
 */
function scoreSource(
  source: ReleaseSource,
  config: ScoringConfig
): { score: number; rules: string[] } {
  const rules: string[] = [];
  let score = 0;

  if (source === 'DISCOGS') {
    score = config.sources.discogs.baseScore;
    if (score !== 0) {
      rules.push(`Discogs source bonus (${score > 0 ? '+' : ''}${score})`);
    }
  } else if (source === 'MUSICBRAINZ') {
    score = config.sources.musicbrainz.baseScore;
    if (score !== 0) {
      rules.push(`MusicBrainz source bonus (${score > 0 ? '+' : ''}${score})`);
    }
  }

  return { score, rules };
}

/**
 * Calculate the complete score for a release
 * Implements FR-SC-1
 *
 * @param release - The normalized release to score
 * @param config - Optional scoring configuration (uses default if not provided)
 * @returns Complete scoring result with breakdown
 */
export function scoreRelease(
  release: NormalizedRelease,
  config?: ScoringConfig
): ScoringResult {
  const cfg = config ?? getScoringConfig();
  const appliedRules: string[] = [];

  // Score each component
  const mediaType = scoreMediaType(release, cfg);
  const country = scoreCountry(release, cfg);
  const trackList = scoreTrackList(release, cfg);
  const coverArt = scoreCoverArt(release, cfg);
  const labelInfo = scoreLabelInfo(release, cfg);
  const sourceBonus = scoreSource(release.source, cfg);

  // Collect all rules
  appliedRules.push(...mediaType.rules);
  appliedRules.push(...country.rules);
  appliedRules.push(...trackList.rules);
  appliedRules.push(...coverArt.rules);
  appliedRules.push(...labelInfo.rules);
  appliedRules.push(...sourceBonus.rules);

  // Build breakdown
  const breakdown: ScoreBreakdown = {
    mediaType: mediaType.score,
    country: country.score,
    trackList: trackList.score,
    coverArt: coverArt.score,
    labelInfo: labelInfo.score,
    sourceBonus: sourceBonus.score,
  };

  // Calculate total
  const totalScore =
    breakdown.mediaType +
    breakdown.country +
    breakdown.trackList +
    breakdown.coverArt +
    breakdown.labelInfo +
    breakdown.sourceBonus;

  return {
    releaseId: release.id,
    source: release.source,
    totalScore,
    breakdown,
    appliedRules,
  };
}

/**
 * Score all releases in a group
 *
 * @param releases - Array of normalized releases
 * @param config - Optional scoring configuration
 * @returns Array of scoring results
 */
export function scoreReleases(
  releases: NormalizedRelease[],
  config?: ScoringConfig
): ScoringResult[] {
  const cfg = config ?? getScoringConfig();
  return releases.map((r) => scoreRelease(r, cfg));
}

/**
 * Apply tie-breaking rules to select between releases with equal scores
 * Implements FR-SC-5 (deterministic tie-breaking)
 *
 * @param releases - Releases with equal scores
 * @param scores - Their scoring results
 * @param config - Scoring configuration
 * @returns Index of the selected release
 */
function applyTieBreaker(
  releases: NormalizedRelease[],
  scores: ScoringResult[],
  config: ScoringConfig
): number {
  if (releases.length === 1) return 0;

  switch (config.tieBreaker) {
    case 'earliestYear': {
      // Select release with earliest year (nulls go last)
      let bestIndex = 0;
      let bestYear = releases[0].year ?? Infinity;
      for (let i = 1; i < releases.length; i++) {
        const year = releases[i].year ?? Infinity;
        if (year < bestYear) {
          bestYear = year;
          bestIndex = i;
        } else if (year === bestYear) {
          // Secondary tie-breaker: smallest ID for determinism (QR-01)
          if (releases[i].id < releases[bestIndex].id) {
            bestIndex = i;
          }
        }
      }
      return bestIndex;
    }

    case 'smallestId': {
      // Select release with smallest (lexicographically) ID
      let bestIndex = 0;
      for (let i = 1; i < releases.length; i++) {
        if (releases[i].id < releases[bestIndex].id) {
          bestIndex = i;
        }
      }
      return bestIndex;
    }

    case 'preferDiscogs': {
      // Prefer Discogs releases, then fall back to earliest year
      const discogsIndex = releases.findIndex((r) => r.source === 'DISCOGS');
      if (discogsIndex >= 0) return discogsIndex;
      // Fall back to earliest year
      return applyTieBreaker(releases, scores, { ...config, tieBreaker: 'earliestYear' });
    }

    case 'preferMusicBrainz': {
      // Prefer MusicBrainz releases, then fall back to earliest year
      const mbIndex = releases.findIndex((r) => r.source === 'MUSICBRAINZ');
      if (mbIndex >= 0) return mbIndex;
      // Fall back to earliest year
      return applyTieBreaker(releases, scores, { ...config, tieBreaker: 'earliestYear' });
    }

    default:
      // Default to first release for unknown tie-breaker
      return 0;
  }
}

/**
 * Select the primary release from a group based on scores
 * Implements FR-SC-5
 *
 * @param group - The release group
 * @param config - Optional scoring configuration
 * @returns The selected primary release and all scoring results
 */
export function selectPrimaryRelease(
  group: ReleaseGroup,
  config?: ScoringConfig
): {
  primary: NormalizedRelease;
  primaryScore: ScoringResult;
  allScores: ScoringResult[];
} {
  const cfg = config ?? getScoringConfig();
  const releases = group.releases;

  // Handle single-release groups (FR-NG-3)
  if (releases.length === 1) {
    const score = scoreRelease(releases[0], cfg);
    return {
      primary: releases[0],
      primaryScore: score,
      allScores: [score],
    };
  }

  // Score all releases
  const allScores = releases.map((r) => scoreRelease(r, cfg));

  // Find the highest score
  let maxScore = allScores[0].totalScore;
  for (const score of allScores) {
    if (score.totalScore > maxScore) {
      maxScore = score.totalScore;
    }
  }

  // Find all releases with the max score
  const topIndices: number[] = [];
  for (let i = 0; i < allScores.length; i++) {
    if (allScores[i].totalScore === maxScore) {
      topIndices.push(i);
    }
  }

  // Apply tie-breaker if needed
  let primaryIndex: number;
  if (topIndices.length === 1) {
    primaryIndex = topIndices[0];
  } else {
    // Get the releases and scores for tie-breaking
    const topReleases = topIndices.map((i) => releases[i]);
    const topScores = topIndices.map((i) => allScores[i]);
    const tieWinnerIndex = applyTieBreaker(topReleases, topScores, cfg);
    primaryIndex = topIndices[tieWinnerIndex];
  }

  return {
    primary: releases[primaryIndex],
    primaryScore: allScores[primaryIndex],
    allScores,
  };
}

/**
 * Score and select primary releases for multiple groups
 *
 * @param groups - Array of release groups
 * @param config - Optional scoring configuration
 * @returns Array of results with primary release and scores for each group
 */
export function scoreAndSelectPrimaryReleases(
  groups: ReleaseGroup[],
  config?: ScoringConfig
): Array<{
  group: ReleaseGroup;
  primary: NormalizedRelease;
  primaryScore: ScoringResult;
  allScores: ScoringResult[];
}> {
  const cfg = config ?? getScoringConfig();

  return groups.map((group) => {
    const result = selectPrimaryRelease(group, cfg);
    return {
      group,
      ...result,
    };
  });
}

/**
 * Get a human-readable summary of a scoring result
 * Useful for debugging and QR-02 (traceability)
 *
 * @param result - The scoring result
 * @returns Human-readable summary string
 */
export function formatScoringResult(result: ScoringResult): string {
  const lines = [
    `Release: ${result.releaseId} (${result.source})`,
    `Total Score: ${result.totalScore}`,
    `Breakdown:`,
    `  - Media Type: ${result.breakdown.mediaType}`,
    `  - Country: ${result.breakdown.country}`,
    `  - Track List: ${result.breakdown.trackList}`,
    `  - Cover Art: ${result.breakdown.coverArt}`,
    `  - Label Info: ${result.breakdown.labelInfo}`,
    `  - Source Bonus: ${result.breakdown.sourceBonus}`,
    `Applied Rules:`,
    ...result.appliedRules.map((r) => `  - ${r}`),
  ];
  return lines.join('\n');
}
