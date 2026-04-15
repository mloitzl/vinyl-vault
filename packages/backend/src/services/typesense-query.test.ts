import { describe, it, expect } from 'vitest';
import { buildTypesenseSearchParams } from './typesense-query.js';

describe('buildTypesenseSearchParams', () => {
  const TENANT = 'user_test123';
  const EMPTY_FILTER = {};

  it('produces q=* for an empty query string', () => {
    const params = buildTypesenseSearchParams('', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.q).toBe('*');
  });

  it('passes plain single-word queries through unchanged', () => {
    const params = buildTypesenseSearchParams('Beatles', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.q).toBe('Beatles');
  });

  it('allows 1 typo for long words (>=5 chars)', () => {
    const params = buildTypesenseSearchParams('Beatles', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.num_typos).toBe(1);
  });

  it('disallows typos for short words (<5 chars)', () => {
    const params = buildTypesenseSearchParams('Jazz', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.num_typos).toBe(0);
  });

  it('handles multi-word plain queries', () => {
    const params = buildTypesenseSearchParams('Rolling Stones', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.q).toBe('Rolling Stones');
    expect(params.num_typos).toBe(1); // 'Rolling' is >=5 chars
  });

  it('wraps quoted phrases in double quotes', () => {
    const params = buildTypesenseSearchParams('"dark side of the moon"', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.q).toBe('"dark side of the moon"');
  });

  it('handles +must tokens', () => {
    const params = buildTypesenseSearchParams('+Velvet', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.q).toBe('Velvet');
  });

  it('drops -mustNot tokens from q (Typesense has no cross-field NOT)', () => {
    const params = buildTypesenseSearchParams('Rock -Pop', EMPTY_FILTER, 1, 20, TENANT);
    // -Pop is dropped; Rock remains
    expect(params.q).toBe('Rock');
  });

  it('always includes tenantId in filter_by', () => {
    const params = buildTypesenseSearchParams('', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.filter_by).toContain(`tenantId:=\`${TENANT}\``);
  });

  it('appends genre filter with || for multiple values', () => {
    const params = buildTypesenseSearchParams('', { genre: ['Rock', 'Jazz'] }, 1, 20, TENANT);
    expect(params.filter_by).toContain('releaseGenre:=`Rock` || releaseGenre:=`Jazz`');
  });

  it('appends format filter', () => {
    const params = buildTypesenseSearchParams('', { format: ['LP'] }, 1, 20, TENANT);
    expect(params.filter_by).toContain('releaseFormat:=`LP`');
  });

  it('handles facet values with special characters (backtick escaping)', () => {
    const params = buildTypesenseSearchParams('', { genre: ['Folk, World, & Country'] }, 1, 20, TENANT);
    // Backtick in value name would be stripped; commas and & are preserved inside backtick-quoted value
    expect(params.filter_by).toContain('releaseGenre:=`Folk, World, & Country`');
  });

  it('sets drop_tokens_threshold to 0', () => {
    const params = buildTypesenseSearchParams('', EMPTY_FILTER, 1, 20, TENANT);
    expect(params.drop_tokens_threshold).toBe(0);
  });

  it('propagates page and per_page', () => {
    const params = buildTypesenseSearchParams('', EMPTY_FILTER, 3, 10, TENANT);
    expect(params.page).toBe(3);
    expect(params.per_page).toBe(10);
  });
});
