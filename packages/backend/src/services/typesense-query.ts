/**
 * Typesense query builder.
 *
 * Translates the user-facing query string and the active RecordSearchFilter into Typesense SearchParams.
 *
 * Supported query syntax:
 *   "phrase"   – exact phrase match (words must appear in order)
 *   +term      – term is required (mapped to inclusion in q)
 *   -term      – term is dropped from the query; no true exclusion semantics
 *                (Typesense has no cross-field NOT operator in q)
 *   word       – plain word; short words (< 5 chars) get no typo tolerance
 */

import type { RecordSearchFilter } from '../models/record.js';

// Fields searched for full-text matches (in priority order via query_by_weights)
const QUERY_BY_FIELDS = [
  'releaseArtist',
  'releaseTitle',
  'releaseLabel',
  'releaseGenre',
  'releaseStyle',
  'releaseTrackTitles',
  'notes',
] as const;

// Weights correspond 1:1 with QUERY_BY_FIELDS positions (higher = more important)
const QUERY_BY_WEIGHTS = [10, 8, 4, 4, 4, 3, 2].join(',');

// Fields that Typesense should compute facet counts for
const FACET_FIELDS = [
  'releaseArtist',
  'releaseTitle',
  'releaseGenre',
  'releaseFormat',
  'condition',
  'location',
  'releaseCountry',
] as const;

// Fields from which highlight snippets are generated
const HIGHLIGHT_FIELDS = [
  'releaseArtist',
  'releaseTitle',
  'releaseLabel',
  'releaseGenre',
  'releaseTrackTitles',
  'notes',
] as const;

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildTypesenseSearchParams(
  rawQuery: string,
  filter: RecordSearchFilter,
  page: number,
  perPage: number,
  tenantId: string,
): Record<string, unknown> {
  const trimmed = rawQuery.trim();

  // Build the query string and derive typo tolerance
  const { q, numTypos } = buildQuery(trimmed);

  // Build filter_by: tenantId is always required; active facets are appended
  const filterClauses = [`tenantId:=\`${tenantId}\``];
  appendFacetFilters(filterClauses, filter);
  const filterBy = filterClauses.join(' && ');

  return {
    q,
    query_by:             QUERY_BY_FIELDS.join(','),
    query_by_weights:     QUERY_BY_WEIGHTS,
    filter_by:            filterBy,
    facet_by:             FACET_FIELDS.join(','),
    max_facet_values:     20,
    per_page:             perPage,
    page,
    num_typos:            numTypos,
    highlight_fields:     HIGHLIGHT_FIELDS.join(','),
    highlight_full_fields: HIGHLIGHT_FIELDS.join(','),
    // Prefix matching for the last token enables as-you-type feel
    prefix:               trimmed.length > 0 ? 'true' : 'false',
    // Do not drop tokens even when results are sparse — preserves AND-ish behaviour
    drop_tokens_threshold: 0,
  };
}

// ---------------------------------------------------------------------------
// Query string builder
// ---------------------------------------------------------------------------

/** Parsed token kinds from the raw query string. */
interface Token {
  kind: 'phrase' | 'must' | 'mustNot' | 'word';
  value: string;
}

function buildQuery(trimmed: string): { q: string; numTypos: number } {
  if (!trimmed) return { q: '*', numTypos: 0 };

  const isAdvanced = /["']/.test(trimmed) || /(?:^|\s)[+-]\S/.test(trimmed);

  if (!isAdvanced) {
    // Plain query — pass through, derive per-word typo tolerance
    const words = trimmed.split(/\s+/).filter(Boolean);
    const numTypos = words.some((w) => w.length >= 5) ? 1 : 0;
    return { q: trimmed, numTypos };
  }

  const tokens = parseAdvancedQuery(trimmed);

  // Typesense q is built from non-excluded tokens only
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.kind === 'mustNot') continue; // Typesense has no cross-field NOT in q
    if (t.kind === 'phrase') {
      parts.push(`"${t.value}"`);
    } else {
      parts.push(t.value);
    }
  }

  const q = parts.join(' ') || '*';

  // Typo tolerance: allow 1 typo if any non-phrase token is long enough
  const words = tokens
    .filter((t) => t.kind !== 'phrase')
    .flatMap((t) => t.value.split(/\s+/));
  const numTypos = words.some((w) => w.length >= 5) ? 1 : 0;

  return { q, numTypos };
}

function parseAdvancedQuery(trimmed: string): Token[] {
  const tokens: Token[] = [];
  // Match: "quoted phrase", 'single-quoted phrase', +term, -term, plain-word
  const re = /"([^"]+)"|'([^']+)'|([+-])(\S+)|(\S+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(trimmed)) !== null) {
    if (m[1] !== undefined) {
      tokens.push({ kind: 'phrase', value: m[1] });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: 'phrase', value: m[2] });
    } else if (m[3] !== undefined) {
      const kind: Token['kind'] = m[3] === '+' ? 'must' : 'mustNot';
      tokens.push({ kind, value: m[4] });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: 'word', value: m[5] });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Facet filter builder
// ---------------------------------------------------------------------------

/**
 * Wrap a facet value in backticks so Typesense treats it as a literal string,
 * handling values that contain spaces, commas, or other special characters
 * (e.g. "Folk, World, & Country").
 */
function fv(value: string): string {
  return `\`${value.replace(/`/g, '')}\``;
}

function appendFacetFilters(clauses: string[], filter: RecordSearchFilter): void {
  if (filter.artist?.length)    clauses.push(filter.artist.map((v) => `releaseArtist:=${fv(v)}`).join(' || '));
  if (filter.title?.length)     clauses.push(filter.title.map((v) => `releaseTitle:=${fv(v)}`).join(' || '));
  if (filter.genre?.length)     clauses.push(filter.genre.map((v) => `releaseGenre:=${fv(v)}`).join(' || '));
  if (filter.format?.length)    clauses.push(filter.format.map((v) => `releaseFormat:=${fv(v)}`).join(' || '));
  if (filter.condition?.length) clauses.push(filter.condition.map((v) => `condition:=${fv(v)}`).join(' || '));
  if (filter.location?.length)  clauses.push(filter.location.map((v) => `location:=${fv(v)}`).join(' || '));
  if (filter.country?.length)   clauses.push(filter.country.map((v) => `releaseCountry:=${fv(v)}`).join(' || '));
}
