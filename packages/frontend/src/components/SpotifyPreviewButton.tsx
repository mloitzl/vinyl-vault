import { useState, useEffect, useRef } from 'react';
import { getEndpoint } from '../utils/apiUrl.js';

interface SpotifyPreviewButtonProps {
  track: string;
  artist: string;
}

interface PreviewResult {
  previewUrl: string | null;
  spotifyUrl: string | null;
}

type State = 'idle' | 'loading' | 'playing' | 'paused' | 'embed' | 'unavailable';

// Module-level: only one track plays at a time across all instances
let currentStop: (() => void) | null = null;

// Simple cache to avoid duplicate BFF calls per (track, artist) pair
const previewCache = new Map<string, PreviewResult>();

export function SpotifyPreviewButton({ track, artist }: SpotifyPreviewButtonProps) {
  const [state, setState] = useState<State>('idle');
  const [embedTrackId, setEmbedTrackId] = useState<string | null>(null);
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
    // If currently playing this track, stop it
    if (state === 'playing') {
      stopCurrent();
      currentStop = null;
      return;
    }

    // If paused, resume
    if (state === 'paused' && audioRef.current) {
      audioRef.current.play();
      setState('playing');
      return;
    }

    // Stop whatever else is playing
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
      if (result.spotifyUrl) {
        // Extract track ID for the Spotify embed player
        const trackId = result.spotifyUrl.replace('https://open.spotify.com/track/', '').split('?')[0];
        setEmbedTrackId(trackId);
        setState(prev => prev === 'embed' ? 'idle' : 'embed');
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
  const isEmbed = state === 'embed';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        title={
          isPlaying ? 'Stop preview'
          : isPaused ? 'Resume preview'
          : isEmbed ? 'Close Spotify player'
          : 'Play on Spotify'
        }
        className={`w-6 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
          isPlaying || isPaused || isEmbed
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
          // Stop square
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        ) : isEmbed ? (
          // Spotify icon (green = active)
          <SpotifyIcon className="w-3.5 h-3.5" />
        ) : (
          // Play triangle
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      {isEmbed && embedTrackId && (
        <div className="w-full mt-1 rounded overflow-hidden">
          <iframe
            title={`Spotify player: ${track}`}
            src={`https://open.spotify.com/embed/track/${embedTrackId}?utm_source=generator&theme=0`}
            width="100%"
            height="80"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            style={{ border: 'none' }}
          />
        </div>
      )}
    </>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
