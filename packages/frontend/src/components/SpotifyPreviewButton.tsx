import { useState, useEffect, useRef } from 'react';
import { getEndpoint } from '../utils/apiUrl.js';

interface SpotifyPreviewButtonProps {
  track: string;
  artist: string;
  onEmbed?: (trackId: string) => void;
}

interface PreviewResult {
  previewUrl: string | null;
  spotifyUrl: string | null;
}

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

// Module-level: only one track plays at a time across all instances
let currentStop: (() => void) | null = null;

// Simple cache to avoid duplicate BFF calls per (track, artist) pair
const previewCache = new Map<string, PreviewResult>();

export function SpotifyPreviewButton({ track, artist, onEmbed }: SpotifyPreviewButtonProps) {
  const [state, setState] = useState<State>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheKey = `${artist}||${track}`;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopCurrent = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setState('idle');
  };

  const handleClick = async () => {
    if (state === 'playing') {
      stopCurrent();
      currentStop = null;
      return;
    }

    if (state === 'paused' && audioRef.current) {
      audioRef.current.play();
      setState('playing');
      return;
    }

    if (currentStop) {
      currentStop();
      currentStop = null;
    }

    setState('loading');

    let result: PreviewResult;

    if (previewCache.has(cacheKey)) {
      result = previewCache.get(cacheKey)!;
    } else {
      try {
        const params = new URLSearchParams({ track, artist });
        const res = await fetch(getEndpoint(`/api/spotify/preview?${params}`), {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`${res.status}`);
        result = (await res.json()) as PreviewResult;
        previewCache.set(cacheKey, result);
      } catch {
        setState('unavailable');
        return;
      }
    }

    if (!result.previewUrl) {
      setState('idle');
      if (result.spotifyUrl) {
        const trackId = result.spotifyUrl.replace('https://open.spotify.com/track/', '').split('?')[0];
        onEmbed?.(trackId);
      } else {
        setState('unavailable');
      }
      return;
    }

    const audio = new Audio(result.previewUrl);
    audioRef.current = audio;
    currentStop = stopCurrent;

    audio.addEventListener('ended', () => {
      setState('idle');
      audioRef.current = null;
      currentStop = null;
    });

    audio.addEventListener('pause', () => {
      if (audioRef.current === audio) setState('paused');
    });

    audio.play().then(() => setState('playing')).catch(() => setState('idle'));
  };

  if (state === 'unavailable') return null;

  const isPlaying = state === 'playing';
  const isLoading = state === 'loading';
  const isPaused = state === 'paused';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      title={isPlaying ? 'Stop preview' : isPaused ? 'Resume preview' : 'Play on Spotify'}
      className={`w-6 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
        isPlaying || isPaused
          ? 'text-[#1DB954] hover:text-[#1aa34a]'
          : 'text-gray-300 hover:text-[#1DB954]'
      }`}
    >
      {isLoading ? (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : isPlaying ? (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}
