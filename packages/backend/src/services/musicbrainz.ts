// MusicBrainz API service
// Implements simple barcode search and release fetch using the MusicBrainz Web API.

import { config } from '../config/index.js';

const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';

export interface MusicBrainzRelease {
  id: string;
  title: string;
  date?: string;
  country?: string;
  'artist-credit'?: Array<{ name: string }>;
  'label-info'?: Array<{ label?: { name: string } }>;
}

function getUserAgent(): string {
  return config.musicbrainz.userAgent;
}

export async function searchByBarcode(barcode: string): Promise<MusicBrainzRelease[]> {
  if (!barcode) return [];

  const q = `barcode:${encodeURIComponent(barcode)}`;
  const url = `${MUSICBRAINZ_API_BASE}/release?query=${q}&fmt=json&limit=10`;

  const res = await fetch(url, { headers: { 'User-Agent': getUserAgent() } });
  if (!res.ok) {
    throw new Error(`MusicBrainz search failed: ${res.status} ${res.statusText}`);
  }

  const body = await res.json();
  const releases: MusicBrainzRelease[] = Array.isArray(body.releases) ? body.releases : [];
  return releases.map((r: any) => ({
    id: r.id,
    title: r.title,
    date: r.date,
    country: r.country,
    'artist-credit': r['artist-credit'],
    'label-info': r['label-info'],
  }));
}

export async function getReleaseDetails(releaseId: string): Promise<any> {
  if (!releaseId) return null;
  const url = `${MUSICBRAINZ_API_BASE}/release/${encodeURIComponent(
    releaseId
  )}?inc=artists+labels+recordings+media&fmt=json`;
  const res = await fetch(url, { headers: { 'User-Agent': getUserAgent() } });
  if (!res.ok) {
    throw new Error(`MusicBrainz release fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
