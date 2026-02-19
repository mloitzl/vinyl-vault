interface Track {
  position?: string;
  title: string;
  duration?: string;
}

interface TrackListProps {
  tracks: Track[];
}

export function TrackList({ tracks }: TrackListProps) {
  const validTracks = tracks ? tracks.filter((t) => t && t.title && t.title.trim().length > 0) : [];
  if (validTracks.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Tracks ({validTracks.length})
      </h4>
      <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
        {validTracks.map((track, index) => (
          <div key={index} className="px-3 py-1.5 flex items-center text-sm">
            <span className="w-8 text-gray-400 text-xs">{track.position ?? index + 1}</span>
            <span className="flex-1 truncate text-gray-700">{track.title}</span>
            {track.duration && <span className="text-gray-400 text-xs ml-2">{track.duration}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TrackList;
