import { useState } from 'react';

type Track = {
  position?: string;
  title: string;
  duration?: string;
};

type Release = {
  id: string;
  barcode: string;
  artist: string;
  title: string;
  year?: number | null;
  format?: string | null;
  label?: string | null;
  country?: string | null;
  coverImageUrl?: string | null;
  externalId?: string | null;
  source?: string;
  genre?: string[];
  style?: string[];
  trackList?: Track[];
};

type Owner = {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type Record = {
  id: string;
  purchaseDate?: string | null;
  price?: number | null;
  condition?: string | null;
  location?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  release: Release;
  owner: Owner;
};

type RecordCardProps = {
  record: Record;
  onEdit?: (record: Record) => void;
  onDelete?: (record: Record) => void;
};

export function RecordCard({ record, onEdit, onDelete }: RecordCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Cover Image */}
          {record.release.coverImageUrl ? (
            <img
              src={record.release.coverImageUrl}
              alt={`${record.release.title} cover`}
              className="w-24 h-24 rounded object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-24 h-24 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
          )}

          {/* Release Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-gray-900 truncate">{record.release.title}</h3>
            <p className="text-gray-600 truncate">{record.release.artist}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-500">
              {record.release.year && <span>{record.release.year}</span>}
              {record.release.format && (
                <>
                  <span>•</span>
                  <span>{record.release.format}</span>
                </>
              )}
              {record.release.country && (
                <>
                  <span>•</span>
                  <span>{record.release.country}</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <svg
                className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                title="Edit record"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(`Are you sure you want to delete "${record.release.title}"?`)
                  ) {
                    onDelete(record);
                  }
                }}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete record"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Personal Details (Always visible if set) */}
        {(record.condition || record.location || record.price) && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {record.condition && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Condition: {record.condition}
              </span>
            )}
            {record.location && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                📍 {record.location}
              </span>
            )}
            {record.price !== null && record.price !== undefined && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ${record.price.toFixed(2)}
              </span>
            )}
            {record.purchaseDate && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Purchased: {new Date(record.purchaseDate).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* Notes (Always visible if set) */}
        {record.notes && (
          <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700">
            <strong>Notes:</strong> {record.notes}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {/* Release Details */}
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Release Details</h4>
              <dl className="space-y-1">
                {record.release.label && (
                  <div>
                    <dt className="inline text-gray-500">Label: </dt>
                    <dd className="inline text-gray-900">{record.release.label}</dd>
                  </div>
                )}
                {record.release.barcode && (
                  <div>
                    <dt className="inline text-gray-500">Barcode: </dt>
                    <dd className="inline text-gray-900 font-mono">{record.release.barcode}</dd>
                  </div>
                )}
                {record.release.source && (
                  <div>
                    <dt className="inline text-gray-500">Source: </dt>
                    <dd className="inline text-gray-900">{record.release.source}</dd>
                  </div>
                )}
                {record.release.externalId && (
                  <div>
                    <dt className="inline text-gray-500">External ID: </dt>
                    <dd className="inline text-gray-900 font-mono text-xs">
                      {record.release.externalId}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Genres & Styles */}
            {(record.release.genre && record.release.genre.length > 0) ||
            (record.release.style && record.release.style.length > 0) ? (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Genres & Styles</h4>
                <div className="flex flex-wrap gap-1">
                  {record.release.genre?.map((g) => (
                    <span key={g} className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs">
                      {g}
                    </span>
                  ))}
                  {record.release.style?.map((s) => (
                    <span key={s} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Track List */}
            {record.release.trackList && record.release.trackList.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="font-semibold text-gray-700 mb-2">Track List</h4>
                <ol className="space-y-1 text-gray-700">
                  {record.release.trackList.map((track, idx) => (
                    <li key={idx} className="flex items-baseline gap-2">
                      <span className="text-gray-400 text-xs">
                        {track.position || `${idx + 1}.`}
                      </span>
                      <span className="flex-1">{track.title}</span>
                      {track.duration && (
                        <span className="text-gray-400 text-xs">{track.duration}</span>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Metadata */}
            <div className="md:col-span-2 text-xs text-gray-400 pt-2 border-t border-gray-200">
              <div>Added: {new Date(record.createdAt).toLocaleString()}</div>
              {record.updatedAt !== record.createdAt && (
                <div>Updated: {new Date(record.updatedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecordCard;
