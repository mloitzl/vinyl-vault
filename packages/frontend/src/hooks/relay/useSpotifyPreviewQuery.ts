import { useCallback, useRef } from 'react';
import { fetchQuery, graphql } from 'relay-runtime';
import { useRelayEnvironment } from 'react-relay';
import type { useSpotifyPreviewQuery as UseSpotifyPreviewQueryType } from '../../__generated__/useSpotifyPreviewQuery.graphql';

const SpotifyPreviewQuery = graphql`
  query useSpotifyPreviewQuery($track: String!, $artist: String!) {
    spotifyPreview(track: $track, artist: $artist) {
      previewUrl
      spotifyUrl
    }
  }
`;

export interface SpotifyPreviewResult {
  previewUrl: string | null;
  spotifyUrl: string | null;
}

export function useSpotifyPreviewQuery() {
  const environment = useRelayEnvironment();
  // Module-level cache keyed by "artist||track"; reuse Relay store across calls
  const cacheRef = useRef(new Map<string, SpotifyPreviewResult>());

  const fetchPreview = useCallback(
    async (track: string, artist: string): Promise<SpotifyPreviewResult> => {
      const key = `${artist}||${track}`;
      if (cacheRef.current.has(key)) {
        return cacheRef.current.get(key)!;
      }

      const data = await fetchQuery<UseSpotifyPreviewQueryType>(
        environment,
        SpotifyPreviewQuery,
        { track, artist },
        { fetchPolicy: 'network-only' }
      ).toPromise();

      const raw = data?.spotifyPreview;
      const result: SpotifyPreviewResult = {
        previewUrl: raw?.previewUrl ?? null,
        spotifyUrl: raw?.spotifyUrl ?? null,
      };

      cacheRef.current.set(key, result);
      return result;
    },
    [environment]
  );

  return { fetchPreview };
}
