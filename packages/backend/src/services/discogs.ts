// Discogs API service
// Implements barcode lookup via the Discogs database search API.

import { config } from '../config/index.js';

const DISCOGS_API_BASE = 'https://api.discogs.com';

export interface DiscogsSearchResult {
  id: string;
  title: string;
  year?: string;
  format?: string[];
  label?: string[];
  country?: string;
  barcode?: string[];
  cover_image?: string;
}

function getAuthHeader(): Record<string, string> {
  const token = config.discogs.apiToken;
  if (token) {
    return { Authorization: `Discogs token=${token}` };
  } else {
    console.log('No Discogs API token found in environment variables');
  }
  return {};
}

export async function searchByBarcode(barcode: string): Promise<DiscogsSearchResult[]> {
  console.log('Searching Discogs for barcode:', barcode);
  if (!barcode) return [];
  const url = `${DISCOGS_API_BASE}/database/search?barcode=${encodeURIComponent(
    barcode
  )}&type=release&per_page=10`;
  const headers = {
    'User-Agent': config.musicbrainz.userAgent,
    ...getAuthHeader(),
  };

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Discogs search failed: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  const rawResults: any[] = Array.isArray(body.results) ? body.results : [];
  console.log(`Discogs search found ${rawResults.length} results for barcode ${barcode}`);
  console.log('Results:', rawResults);

  // Helper: extract id from known fields (id, resource_url, uri)
  function extractId(r: any): string | null {
    if (r == null) return null;
    if (r.id) return String(r.id);
    if (r.resource_url) {
      const m = String(r.resource_url).match(/releases\/(\d+)/);
      if (m) return m[1];
    }
    if (r.uri) {
      const m = String(r.uri).match(/release\/(\d+)/);
      if (m) return m[1];
      // sometimes uri looks like "/release/33535479-Mumford-Sons-Rushmere"
      const m2 = String(r.uri).match(/^(?:\/release\/)?(\d+)/);
      if (m2) return m2[1];
    }
    return null;
  }

  const mapped = rawResults
    .map((r: any) => ({
      id: extractId(r),
      title: r.title,
      year: r.year?.toString(),
      format: r.format ? (Array.isArray(r.format) ? r.format : [r.format]) : undefined,
      label: r.label ? (Array.isArray(r.label) ? r.label : [r.label]) : undefined,
      country: r.country,
      barcode: r.barcode,
      cover_image: r.cover_image,
    }))
    // Filter out any results that couldn't provide a non-null id. GraphQL expects Release.id non-nullable.
    .filter((r) => r.id != null) as DiscogsSearchResult[];

  return mapped;
}

export async function getReleaseDetails(releaseId: string | number): Promise<any> {
  if (!releaseId) return null;
  const idStr = String(releaseId);
  const url = `${DISCOGS_API_BASE}/releases/${encodeURIComponent(idStr)}`;
  const headers = {
    'User-Agent': config.musicbrainz.userAgent,
    ...getAuthHeader(),
  };
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Discogs release fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
