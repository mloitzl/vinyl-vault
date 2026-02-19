import { useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { ScoreBreakdownDisplay } from './ScoreBreakdownDisplay';
import { TrackList } from './TrackList';
import { AlternativeReleasesList } from './AlternativeReleasesList';

interface Track {
  position?: string;
  title: string;
  duration?: string;
}

interface Release {
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
}

interface ScoreBreakdown {
  mediaType: number;
  countryPreference: number;
  trackListCompleteness: number;
  coverArt: number;
  labelInfo: number;
  catalogNumber: number;
  yearInfo: number;
  sourceBonus: number;
}

interface ScoredRelease {
  release: Release;
  score: number;
  scoreBreakdown?: ScoreBreakdown | null;
}

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

interface Album {
  id: string;
  artist: string;
  title: string;
  barcodes: string[];
  primaryRelease: ScoredRelease;
  alternativeReleases: AlternativeRelease[];
  trackList?: Track[] | null;
  genres: string[];
  styles: string[];
  externalIds: { discogs: string[]; musicbrainz: string[] };
  coverImageUrl?: string | null;
  otherTitles: string[];
  editionNotes: string[];
  releaseCount: number;
  score: number;
}

interface AlbumCardProps {
  album: Album;
  isSelected: boolean;
  onSelect: () => void;
}

export function AlbumCard({ album, isSelected, onSelect }: AlbumCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const primary = album.primaryRelease;
  const breakdown = primary.scoreBreakdown;

  return (
    <Card
      className={`overflow-hidden transition-shadow ${
        isSelected ? 'border-emerald-500 shadow-md shadow-emerald-100' : 'border-gray-200'
      }`}
      interactive={true}
      onClick={onSelect}
    >
      {/* Main album info - clickable header */}
      <div
        className={`p-4 cursor-pointer ${
          isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'
        }`}
      >
        <div className="flex gap-4">
          {/* Cover image */}
          <div className="flex-shrink-0">
            {album.coverImageUrl ? (
              <img
                src={album.coverImageUrl}
                alt={album.title}
                className="w-20 h-20 object-cover rounded shadow-sm"
              />
            ) : (
              <div className="w-20 h-20 bg-gray-100 rounded shadow-sm flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                </svg>
              </div>
            )}
          </div>

          {/* Album info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h3 className="font-semibold text-gray-900 truncate">{album.title}</h3>
            <p className="text-sm text-gray-600 truncate">{album.artist}</p>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
              {primary.release.year && <span>{primary.release.year}</span>}
              {primary.release.year && primary.release.country && (
                <span className="text-gray-300">|</span>
              )}
              {primary.release.country && <span>{primary.release.country}</span>}
              {(primary.release.year || primary.release.country) && primary.release.label && (
                <span className="text-gray-300">|</span>
              )}
              {primary.release.label && (
                <span className="truncate max-w-[120px]">{primary.release.label}</span>
              )}
            </div>
          </div>

          {/* Score badge and metadata */}
          <div className="flex-shrink-0 flex flex-col items-end justify-between">
            <Badge variant="default" className="px-2.5 py-1 rounded text-sm font-semibold">
              {album.score}
            </Badge>
            <div className="text-xs text-gray-400 text-right">
              {album.releaseCount} {album.releaseCount === 1 ? 'release' : 'releases'}
            </div>
          </div>
        </div>
      </div>

      {/* Expand/collapse button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="w-full px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-2 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
      </button>

      {/* Expanded details section */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50">
          {/* Quick info bar */}
          <div className="px-4 py-3 flex flex-wrap gap-x-4 gap-y-1 text-xs border-b border-gray-100">
            {primary.release.format && (
              <span className="text-gray-600">
                <span className="text-gray-400">Format:</span> {primary.release.format}
              </span>
            )}
            <span className="text-gray-600">
              <span className="text-gray-400">Source:</span>{' '}
              <span
                className={
                  primary.release.source === 'DISCOGS' ? 'text-orange-600' : 'text-blue-600'
                }
              >
                {primary.release.source}
              </span>
            </span>
            {album.genres.length > 0 && (
              <span className="text-gray-600">
                <span className="text-gray-400">Genre:</span> {album.genres.slice(0, 2).join(', ')}
              </span>
            )}
          </div>

          {/* Details content */}
          <div className="p-4 space-y-4">
            {breakdown && <ScoreBreakdownDisplay breakdown={breakdown} />}
            {album.trackList && <TrackList tracks={album.trackList} />}
            {album.alternativeReleases.length > 0 && (
              <AlternativeReleasesList releases={album.alternativeReleases} />
            )}

            {/* Styles as tags */}
            {album.styles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {album.styles.map((s, i) => (
                  <Badge key={i} variant="info" className="text-xs px-2 py-0.5">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="bg-emerald-600 text-white text-center py-2 text-sm font-semibold flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          Selected
        </div>
      )}
    </Card>
  );
}

export default AlbumCard;
