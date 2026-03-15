import { useState, useEffect } from 'react';
import { SpotifyPreviewButton } from './SpotifyPreviewButton';
import { useAuth } from '../contexts/AuthContext';

interface Track {
  position?: string;
  title: string;
  duration?: string;
}

interface TrackListProps {
  tracks: Track[];
  artist?: string;
}

interface SpotifyPlaybackPayload {
  isPaused?: boolean;
  position?: number;
  duration?: number;
}

export function TrackList({ tracks, artist }: TrackListProps) {
  const { user } = useAuth();
  const spotifyEnabled = user?.settings?.spotifyPreview === true;
  const [activeEmbed, setActiveEmbed] = useState<{ index: number; trackId: string } | null>(null);

  // Listen for Spotify embed postMessage events to detect end of playback
  useEffect(() => {
    if (!activeEmbed) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://open.spotify.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'playback_update') {
          const { isPaused, position, duration } = (data.payload ?? {}) as SpotifyPlaybackPayload;
          if (
            isPaused === true &&
            typeof position === 'number' &&
            typeof duration === 'number' &&
            duration > 0 && position > 0 && position / duration >= 0.95
          ) {
            setActiveEmbed(null);
          }
        }
      } catch {
        // ignore unparseable messages
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeEmbed]);

  const validTracks = tracks ? tracks.filter((t) => t && t.title && t.title.trim().length > 0) : [];
  if (validTracks.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Tracks ({validTracks.length})
      </h4>
      <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
        {validTracks.map((track, index) => {
          // When this track's embed is active, replace the whole row with the iframe
          if (activeEmbed?.index === index) {
            return (
              <div key={index} className="relative flex items-center">
                <iframe
                  title={track.title}
                  src={`https://open.spotify.com/embed/track/${activeEmbed.trackId}?utm_source=generator&theme=0&autoplay=1`}
                  width="100%"
                  height="80"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ border: 'none', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => setActiveEmbed(null)}
                  title="Close player"
                  aria-label="Close player"
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/40 text-white text-xs hover:bg-black/70 transition-colors"
                >
                  ✕
                </button>
              </div>
            );
          }

          return (
            <div key={index} className="px-3 py-1.5 flex items-center text-sm">
              {artist && spotifyEnabled && (
                <SpotifyPreviewButton
                  track={track.title}
                  artist={artist}
                  onEmbed={(trackId) => setActiveEmbed({ index, trackId })}
                />
              )}
              <span className="w-8 text-gray-400 text-xs flex-shrink-0">
                {track.position ?? index + 1}
              </span>
              <span className="flex-1 truncate text-gray-700">{track.title}</span>
              {track.duration && <span className="text-gray-400 text-xs ml-2">{track.duration}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TrackList;
