import { useState, useEffect, useRef } from 'react';
import { useSpotifyPreviewQuery, type SpotifyPreviewResult } from '../hooks/relay/useSpotifyPreviewQuery.js';

interface SpotifyPreviewButtonProps {
  track: string;
  artist: string;
  onEmbed?: (trackId: string) => void;
}

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'unavailable';

// Module-level: only one track plays at a time across all instances
let currentStop: (() => void) | null = null;

export function SpotifyPreviewButton({ track, artist, onEmbed }: SpotifyPreviewButtonProps) {
  const [state, setState] = useState<State>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const { fetchPreview } = useSpotifyPreviewQuery();

  // Cleanup on unmount: pause audio and clear global pointer if it points to this instance
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Prevent stale reference from triggering setState on this unmounted instance
      if (currentStop === stopCurrentRef.current) {
        currentStop = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCurrent = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (mountedRef.current) setState('idle');
  };

  // Keep a stable ref to stopCurrent for the unmount cleanup comparison
  const stopCurrentRef = useRef(stopCurrent);
  stopCurrentRef.current = stopCurrent;

  const handleClick = async () => {
    if (state === 'playing') {
      stopCurrent();
      currentStop = null;
      return;
    }

    if (state === 'paused' && audioRef.current) {
      audioRef.current.play()
        .then(() => { if (mountedRef.current) setState('playing'); })
        .catch(() => { if (mountedRef.current) setState('idle'); });
      return;
    }

    if (currentStop) {
      currentStop();
      currentStop = null;
    }

    setState('loading');

    let result: SpotifyPreviewResult;
    try {
      result = await fetchPreview(track, artist);
    } catch {
      if (mountedRef.current) setState('unavailable');
      return;
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
    currentStop = stopCurrentRef.current;

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
      title={isPlaying ? 'Stop preview' : isPaused ? 'Resume preview' : 'Play 30-second preview'}
      aria-label={isPlaying ? 'Stop preview' : isPaused ? 'Resume preview' : 'Play 30-second preview'}
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
