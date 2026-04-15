import { describe, it, expect } from 'vitest';
import { mapTypesenseHighlights } from './typesense-highlights.js';

describe('mapTypesenseHighlights', () => {
  it('returns empty array when hit has no highlights', () => {
    expect(mapTypesenseHighlights({})).toEqual([]);
    expect(mapTypesenseHighlights({ highlights: [] })).toEqual([]);
  });

  it('parses a simple snippet with one match', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'releaseTitle', snippet: 'Fire <mark>Guns</mark> of the Moon' },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('releaseTitle');
    expect(result[0].texts).toEqual([
      { value: 'Fire ', type: 'text' },
      { value: 'Guns', type: 'hit' },
      { value: ' of the Moon', type: 'text' },
    ]);
  });

  it('handles a snippet that starts with a hit', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'releaseArtist', snippet: '<mark>Beatles</mark> Anthology' },
      ],
    });
    expect(result[0].texts).toEqual([
      { value: 'Beatles', type: 'hit' },
      { value: ' Anthology', type: 'text' },
    ]);
  });

  it('handles a snippet that ends with a hit', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'releaseLabel', snippet: 'Blue Note <mark>Records</mark>' },
      ],
    });
    expect(result[0].texts).toEqual([
      { value: 'Blue Note ', type: 'text' },
      { value: 'Records', type: 'hit' },
    ]);
  });

  it('handles multiple marks in one snippet', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'notes', snippet: '<mark>Great</mark> album, <mark>great</mark> cover' },
      ],
    });
    expect(result[0].texts).toEqual([
      { value: 'Great', type: 'hit' },
      { value: ' album, ', type: 'text' },
      { value: 'great', type: 'hit' },
      { value: ' cover', type: 'text' },
    ]);
  });

  it('uses snippets[] for array fields', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        {
          field: 'releaseGenre',
          snippets: ['<mark>Rock</mark>', 'Classical'],
        },
      ],
    });
    // 'Classical' has no marks so it should produce one text segment
    // 'Rock' has a mark so it produces one hit segment
    expect(result).toHaveLength(2);
    expect(result[0].texts).toEqual([{ value: 'Rock', type: 'hit' }]);
    expect(result[1].texts).toEqual([{ value: 'Classical', type: 'text' }]);
  });

  it('handles multiple highlight fields', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'releaseArtist', snippet: '<mark>Bob</mark> Dylan' },
        { field: 'releaseTitle',  snippet: 'Highway <mark>61</mark> Revisited' },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('releaseArtist');
    expect(result[1].path).toBe('releaseTitle');
  });

  it('skips a field with no snippet and no snippets[]', () => {
    const result = mapTypesenseHighlights({
      highlights: [
        { field: 'releaseArtist' }, // no snippet key at all
      ],
    });
    expect(result).toHaveLength(0);
  });
});
