/**
 * Typesense highlight mapper.
 *
 * Typesense returns highlight snippets as strings with <mark>…</mark> tags.
 * This module converts those snippets into the SearchHighlight[] shape that the
 * existing GraphQL schema and the client-side hl() helper already understand.
 *
 * Example Typesense snippet:
 *   "Fire <mark>Guns</mark> of the Moon"
 *
 * Becomes:
 *   [
 *     { value: "Fire ",           type: "text" },
 *     { value: "Guns",            type: "hit"  },
 *     { value: " of the Moon",    type: "text" },
 *   ]
 */

import type { SearchHighlight, SearchHighlightText } from '../models/record.js';

const MARK_RE = /<mark>(.*?)<\/mark>/g;

/**
 * Parse a <mark>-tagged Typesense snippet string into a SearchHighlightText array.
 * Returns an empty array for blank / missing snippets.
 */
function parseSnippet(snippet: string): SearchHighlightText[] {
  if (!snippet) return [];

  const texts: SearchHighlightText[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MARK_RE.lastIndex = 0;

  while ((match = MARK_RE.exec(snippet)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      texts.push({ value: snippet.slice(lastIndex, match.index), type: 'text' });
    }
    // The matched (highlighted) word
    texts.push({ value: match[1], type: 'hit' });
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the last match
  if (lastIndex < snippet.length) {
    texts.push({ value: snippet.slice(lastIndex), type: 'text' });
  }

  return texts;
}

/**
 * Map all highlights from a single Typesense search hit into SearchHighlight[].
 * Each highlight entry corresponds to one field that contained a match.
 *
 * Typesense may return:
 *   - `snippet` for single-value string fields
 *   - `snippets[]` for array fields (string[]) — one snippet per matched array element
 */
export function mapTypesenseHighlights(hit: {
  highlights?: Array<{
    field: string;
    snippet?: string;
    snippets?: string[];
    matched_tokens?: string[] | string[][];
  }>;
}): SearchHighlight[] {
  if (!hit.highlights?.length) return [];

  const result: SearchHighlight[] = [];

  for (const hl of hit.highlights) {
    const snippets: string[] = [];

    if (hl.snippets?.length) {
      // Array field — collect all matching element snippets
      snippets.push(...hl.snippets.filter(Boolean));
    } else if (hl.snippet) {
      snippets.push(hl.snippet);
    }

    for (const snippet of snippets) {
      const texts = parseSnippet(snippet);
      if (texts.length > 0) {
        result.push({ path: hl.field, texts });
      }
    }
  }

  return result;
}
