interface AlternativeRelease {
  externalId: string;
  source: string;
  country?: string | null;
  year?: number | null;
  format?: string | null;
  label?: string | null;
  score: number;
  editionNote?: string | null;
}

interface AlternativeReleasesListProps {
  releases: AlternativeRelease[];
}

export function AlternativeReleasesList({ releases }: AlternativeReleasesListProps) {
  if (!releases || releases.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Other Releases ({releases.length})
      </h4>
      <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-32 overflow-y-auto">
        {releases.map((alt, index) => (
          <div key={index} className="px-3 py-1.5 flex items-center text-xs gap-3">
            <span
              className={`w-16 ${alt.source === 'DISCOGS' ? 'text-orange-600' : 'text-blue-600'}`}
            >
              {alt.source}
            </span>
            <span className="w-10 text-gray-600">{alt.country ?? '—'}</span>
            <span className="w-10 text-gray-600">{alt.year ?? '—'}</span>
            <span className="flex-1 text-gray-500 truncate">{alt.label ?? '—'}</span>
            <span className="text-gray-700 font-medium tabular-nums">{alt.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AlternativeReleasesList;
