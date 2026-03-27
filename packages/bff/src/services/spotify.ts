import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

export interface SpotifyPreviewResult {
  previewUrl: string | null;
  spotifyUrl: string | null;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) return null;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    logger.error({ status: response.status }, 'Spotify token request failed');
    return null;
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  // Subtract 60s from expiry to avoid using a stale token
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.accessToken;
}

async function searchTrack(
  track: string,
  artist: string,
  token: string
): Promise<SpotifyPreviewResult> {
  const q = encodeURIComponent(`track:${track} artist:${artist}`);
  const url = `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    logger.warn({ status: response.status, track, artist }, 'Spotify search failed');
    return { previewUrl: null, spotifyUrl: null };
  }

  const data = (await response.json()) as {
    tracks: { items: Array<{ preview_url: string | null; external_urls: { spotify: string } }> };
  };

  const item = data.tracks?.items?.[0];
  if (!item) return { previewUrl: null, spotifyUrl: null };

  return {
    previewUrl: item.preview_url,
    spotifyUrl: item.external_urls?.spotify ?? null,
  };
}

export async function lookupSpotifyPreview(
  track: string,
  artist: string
): Promise<SpotifyPreviewResult> {
  if (!track?.trim() || !artist?.trim()) {
    return { previewUrl: null, spotifyUrl: null };
  }

  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) {
    return { previewUrl: null, spotifyUrl: null };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return { previewUrl: null, spotifyUrl: null };
    }

    return await searchTrack(track, artist, token);
  } catch (err) {
    logger.error({ err, track, artist }, 'Spotify preview lookup failed');
    return { previewUrl: null, spotifyUrl: null };
  }
}
