import { Router } from 'express';
import type { IRouter } from 'express';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const router: IRouter = Router();

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface SpotifyPreviewResult {
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

// GET /api/spotify/preview?track=X&artist=Y
// Returns { previewUrl, spotifyUrl } — both nullable.
// Returns nulls silently if Spotify credentials are not configured.
router.get('/preview', async (req, res) => {
  if (!req.session?.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const track = String(req.query.track ?? '').trim();
  const artist = String(req.query.artist ?? '').trim();

  if (!track || !artist) {
    res.status(400).json({ error: 'track and artist query params are required' });
    return;
  }

  const { clientId, clientSecret } = config.spotify;
  if (!clientId || !clientSecret) {
    res.json({ previewUrl: null, spotifyUrl: null });
    return;
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      res.json({ previewUrl: null, spotifyUrl: null });
      return;
    }

    const result = await searchTrack(track, artist, token);
    res.json(result);
  } catch (err) {
    logger.error({ err, track, artist }, 'Spotify preview lookup failed');
    res.json({ previewUrl: null, spotifyUrl: null });
  }
});

export { router as spotifyRouter };
