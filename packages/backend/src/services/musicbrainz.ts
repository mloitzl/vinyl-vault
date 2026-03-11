// MusicBrainz API service
// Implements simple barcode search and release fetch using the MusicBrainz Web API.

import { config } from '../config/index.js';

const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';
const REQUEST_TIMEOUT_MS = 1500;
const MAX_RETRIES = 2;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const error = err as any;
  const code = error?.cause?.code ?? error?.code;
  const message = String(error?.message ?? '').toLowerCase();

  if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;

  return (
    message.includes('fetch failed') ||
    message.includes('socket disconnected') ||
    message.includes('tls connection') ||
    message.includes('network')
  );
}

async function fetchMusicBrainz(url: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': getUserAgent(),
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok && isRetryableStatus(res.status) && attempt < MAX_RETRIES) {
        await sleep(300 * (attempt + 1));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err;
      if (attempt >= MAX_RETRIES || !isRetryableError(err)) {
        throw err;
      }
      await sleep(300 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MusicBrainz request failed');
}

export async function searchByBarcode(barcode: string): Promise<MusicBrainzRelease[]> {
  if (!barcode) return [];

  const q = `barcode:${encodeURIComponent(barcode)}`;
  const url = `${MUSICBRAINZ_API_BASE}/release?query=${q}&fmt=json&limit=10`;

  const res = await fetchMusicBrainz(url);
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
  const res = await fetchMusicBrainz(url);
  if (!res.ok) {
    throw new Error(`MusicBrainz release fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
