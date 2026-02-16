import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserMultiFormatReader } from '@zxing/browser';
import { BrowserMultiFormatReader as ZXingBrowserMultiFormatReader } from '@zxing/browser';
import { Toast } from './Toast';
import { getEndpoint } from '../utils/apiUrl.js';

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

type ScoreBreakdown = {
  mediaType: number;
  countryPreference: number;
  trackListCompleteness: number;
  coverArt: number;
  labelInfo: number;
  catalogNumber: number;
  yearInfo: number;
  sourceBonus: number;
};

type ScoredRelease = {
  release: Release;
  score: number;
  scoreBreakdown?: ScoreBreakdown | null;
};

type AlternativeRelease = {
  externalId: string;
  source: string;
  country?: string | null;
  year?: number | null;
  format?: string | null;
  label?: string | null;
  score: number;
  editionNote?: string | null;
};

type Album = {
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
};

type LookupTiming = {
  discogsMs: number;
  musicbrainzMs: number;
  scoringMs: number;
  totalMs: number;
};

export function ScanBarcode({ onRecordAdded }: { onRecordAdded?: () => void }) {
  const [barcode, setBarcode] = useState('5099902988313');
  const [isLoading, setIsLoading] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [timing, setTiming] = useState<LookupTiming | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false);

  const lookup = useCallback(async (bc: string) => {
    setIsLoading(true);
    setErrors([]);
    setAlbums([]);
    setTiming(null);
    setSelectedAlbumId(null);
    setExpandedAlbumId(null);

    // BFF exposes `scanBarcode` mutation with albums (blended scoring)
    const query = `mutation Scan($barcode: String!) {
      scanBarcode(barcode: $barcode) {
        albums {
          id
          artist
          title
          barcodes
          primaryRelease {
            release {
              id barcode artist title year format label country coverImageUrl externalId source genre style
              trackList { position title duration }
            }
            score
            scoreBreakdown {
              mediaType countryPreference trackListCompleteness coverArt labelInfo catalogNumber yearInfo sourceBonus
            }
          }
          alternativeReleases { externalId source country year format label score editionNote }
          trackList { position title duration }
          genres
          styles
          externalIds { discogs musicbrainz }
          coverImageUrl
          otherTitles
          editionNotes
          releaseCount
          score
        }
        timing { totalMs }
        errors
      }
    }`;

    try {
      const res = await fetch(getEndpoint('/graphql'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables: { barcode: bc } }),
      });
      const body = await res.json();

      // Handle GraphQL errors
      if (body.errors) {
        setErrors(body.errors.map((e: any) => e.message));
      }

      // Process data even if there were some errors
      const payload = body.data?.scanBarcode;
      if (payload) {
        if (payload.errors && payload.errors.length) {
          setErrors((prev) => [...prev, ...payload.errors]);
        }
        if (payload.albums) {
          setAlbums(payload.albums);
        }
        if (payload.timing) setTiming(payload.timing);
      }
    } catch (err: any) {
      setErrors([err?.message ?? String(err)]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const onSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!barcode) return;
      lookup(barcode.trim());
    },
    [barcode, lookup]
  );

  // Camera scanning using BarcodeDetector if available
  const startCamera = useCallback(async () => {
    if (scanningRef.current) return;
    scanningRef.current = true;
    setErrors([]);
    detectedRef.current = false;

    try {
      const BarcodeDetector = (window as any).BarcodeDetector;
      if (BarcodeDetector) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_e', 'upc_a'] });

        const loop = async () => {
          if (!scanningRef.current) return;
          try {
            if (!videoRef.current || videoRef.current.readyState < 2) {
              requestAnimationFrame(loop);
              return;
            }
            const detections = await detector.detect(videoRef.current);
            if (detections && detections.length > 0) {
              if (detectedRef.current) return;
              detectedRef.current = true;
              const code = detections[0].rawValue;
              setBarcode(code);
              stopCamera();
              lookup(code);
              return;
            }
          } catch {
            // detection errors
          }
          requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
      } else {
        // Fallback for browsers without BarcodeDetector (e.g. Safari) using ZXing
        try {
          const reader = new ZXingBrowserMultiFormatReader();
          zxingRef.current = reader;

          // Use single-shot decode to avoid continuous background streams in Safari
          const result = await reader.decodeOnceFromVideoDevice(
            undefined,
            videoRef.current as HTMLVideoElement
          );

          if (result) {
            if (!detectedRef.current) {
              detectedRef.current = true;
              const code = result.getText();
              setBarcode(code);
              try {
                (zxingRef.current as { reset?: () => void })?.reset?.();
              } catch {
                // ignore
              }
              stopCamera();
              lookup(code);
            }
          }
        } catch (err: unknown) {
          // decodeOnceFromVideoDevice may throw if no barcode is found or on other errors.
          const message = err instanceof Error ? err.message : String(err);
          setErrors((s) => [...s, message || 'Barcode detection not available in this browser.']);
          scanningRef.current = false;
        } finally {
          if (zxingRef.current) {
            try {
              (zxingRef.current as { reset?: () => void })?.reset?.();
            } catch {
              // ignore
            }
            zxingRef.current = null;
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrors([message]);
      scanningRef.current = false;
    }
  }, [lookup]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    try {
      if (zxingRef.current) {
        try {
          (zxingRef.current as { reset?: () => void })?.reset?.();
        } catch {
          // ignore
        }
        zxingRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="p-4">
      <form onSubmit={onSubmit} className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Barcode</label>
        <div className="flex gap-2 flex-wrap items-center">
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="flex-1 min-w-0 border rounded px-3 py-2"
            placeholder="Enter or scan barcode (e.g. 0123456789012)"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-3 py-2 rounded w-full sm:w-auto flex-shrink-0"
          >
            {isLoading ? 'Searching...' : 'Lookup'}
          </button>
          <button
            type="button"
            onClick={() => (scanningRef.current ? stopCamera() : startCamera())}
            className="bg-gray-200 px-3 py-2 rounded w-full sm:w-auto flex-shrink-0"
          >
            {scanningRef.current ? 'Stop' : 'Use Camera'}
          </button>
        </div>
      </form>

      <div className="mt-3">
        <video
          ref={videoRef}
          className="w-full rounded bg-black"
          style={{ maxHeight: 360 }}
          playsInline
        />
      </div>

      {errors.length > 0 && (
        <div className="mt-3 text-sm text-red-600">
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {/* Timing info */}
      {timing && (
        <div className="mt-3 text-xs text-gray-500">
          Found {albums.length} album{albums.length !== 1 ? 's' : ''} in {timing.totalMs}ms
        </div>
      )}

      {/* Albums list */}
      {albums.length > 0 && (
        <div className="mt-6 space-y-3">
          {albums.map((album) => {
            const isSelected = selectedAlbumId === album.id;
            const isExpanded = expandedAlbumId === album.id;
            const primary = album.primaryRelease;
            const breakdown = primary.scoreBreakdown;

            return (
              <div
                key={album.id}
                className={`border rounded-lg overflow-hidden transition-shadow ${
                  isSelected
                    ? 'border-emerald-500 shadow-md shadow-emerald-100'
                    : 'border-gray-200 hover:shadow-sm'
                }`}
              >
                {/* Main album card - clickable to select */}
                <div
                  className={`p-4 cursor-pointer ${
                    isSelected ? 'bg-emerald-50' : 'bg-white hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedAlbumId(isSelected ? null : album.id)}
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
                          <svg
                            className="w-8 h-8 text-gray-300"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Album info - simplified */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <h3 className="font-semibold text-gray-900 truncate">{album.title}</h3>
                      <p className="text-sm text-gray-600 truncate">{album.artist}</p>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                        {primary.release.year && <span>{primary.release.year}</span>}
                        {primary.release.year && primary.release.country && (
                          <span className="text-gray-300">|</span>
                        )}
                        {primary.release.country && <span>{primary.release.country}</span>}
                        {(primary.release.year || primary.release.country) &&
                          primary.release.label && <span className="text-gray-300">|</span>}
                        {primary.release.label && (
                          <span className="truncate max-w-[120px]">{primary.release.label}</span>
                        )}
                      </div>
                    </div>

                    {/* Right side - Score and meta */}
                    <div className="flex-shrink-0 flex flex-col items-end justify-between">
                      <div className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded text-sm font-semibold tabular-nums">
                        {album.score}
                      </div>
                      <div className="text-xs text-gray-400 text-right">
                        {album.releaseCount} {album.releaseCount === 1 ? 'release' : 'releases'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expand/collapse toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedAlbumId(isExpanded ? null : album.id);
                  }}
                  className="w-full px-4 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-t border-gray-100 flex items-center justify-center gap-1 transition-colors"
                >
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                  <span>{isExpanded ? 'Less' : 'More'}</span>
                </button>

                {/* Expanded details */}
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
                            primary.release.source === 'DISCOGS'
                              ? 'text-orange-600'
                              : 'text-blue-600'
                          }
                        >
                          {primary.release.source}
                        </span>
                      </span>
                      {album.genres.length > 0 && (
                        <span className="text-gray-600">
                          <span className="text-gray-400">Genre:</span>{' '}
                          {album.genres.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Score breakdown - compact horizontal */}
                      {breakdown && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Score Breakdown
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { label: 'Media', value: breakdown.mediaType },
                              { label: 'Country', value: breakdown.countryPreference },
                              { label: 'Tracks', value: breakdown.trackListCompleteness },
                              { label: 'Cover', value: breakdown.coverArt },
                              { label: 'Label', value: breakdown.labelInfo },
                              { label: 'Year', value: breakdown.yearInfo },
                            ]
                              .filter((item) => item.value !== 0)
                              .map((item, i) => (
                                <span
                                  key={i}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                                    item.value > 0
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  <span className="text-gray-500">{item.label}</span>
                                  <span className="font-medium">
                                    {item.value > 0 ? '+' : ''}
                                    {item.value}
                                  </span>
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Track list - compact */}
                      {album.trackList && album.trackList.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Tracks ({album.trackList.length})
                          </h4>
                          <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-48 overflow-y-auto">
                            {album.trackList.map((t, ti) => (
                              <div key={ti} className="px-3 py-1.5 flex items-center text-sm">
                                <span className="w-8 text-gray-400 text-xs">
                                  {t.position ?? ti + 1}
                                </span>
                                <span className="flex-1 truncate text-gray-700">{t.title}</span>
                                {t.duration && (
                                  <span className="text-gray-400 text-xs ml-2">{t.duration}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Alternative releases - simplified table */}
                      {album.alternativeReleases.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Other Releases ({album.alternativeReleases.length})
                          </h4>
                          <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100 max-h-32 overflow-y-auto">
                            {album.alternativeReleases.map((alt, ai) => (
                              <div key={ai} className="px-3 py-1.5 flex items-center text-xs gap-3">
                                <span
                                  className={`w-16 ${
                                    alt.source === 'DISCOGS' ? 'text-orange-600' : 'text-blue-600'
                                  }`}
                                >
                                  {alt.source}
                                </span>
                                <span className="w-10 text-gray-600">{alt.country ?? '—'}</span>
                                <span className="w-10 text-gray-600">{alt.year ?? '—'}</span>
                                <span className="flex-1 text-gray-500 truncate">
                                  {alt.label ?? '—'}
                                </span>
                                <span className="text-gray-700 font-medium tabular-nums">
                                  {alt.score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Styles as subtle tags */}
                      {album.styles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {album.styles.map((s, si) => (
                            <span
                              key={si}
                              className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Selection indicator */}
                {isSelected && (
                  <div className="bg-emerald-600 text-white text-center py-2 text-sm font-medium flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Selected
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add to collection button (when album selected) */}
      {selectedAlbumId && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4 md:max-w-none">
            <div className="min-w-0 flex-1">
              {(() => {
                const selected = albums.find((a) => a.id === selectedAlbumId);
                return selected ? (
                  <div className="flex items-center gap-3">
                    {selected.coverImageUrl && (
                      <img
                        src={selected.coverImageUrl}
                        alt=""
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{selected.title}</div>
                      <div className="text-sm text-gray-500 truncate">{selected.artist}</div>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
            <button
              type="button"
              onClick={async () => {
                const selected = albums.find((a) => a.id === selectedAlbumId);
                if (!selected) return;

                setIsLoading(true);

                try {
                  // Create record mutation
                  const mutation = `mutation CreateRecord($input: CreateRecordInput!) {
                    createRecord(input: $input) {
                      record {
                        id
                        purchaseDate
                        price
                        condition
                        location
                        notes
                        createdAt
                        release {
                          id
                          artist
                          title
                          coverImageUrl
                        }
                      }
                      errors
                    }
                  }`;

                  const res = await fetch(getEndpoint('/graphql'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      query: mutation,
                      variables: {
                        input: {
                          releaseId: selected.primaryRelease.release.id,
                        },
                      },
                    }),
                  });

                  const body = await res.json();

                  let hasError = false;

                  if (body.errors) {
                    setToast({
                      message: body.errors[0]?.message || 'Failed to add record',
                      type: 'error',
                    });
                    hasError = true;
                  }

                  const payload = body.data?.createRecord;
                  if (!hasError && payload?.errors && payload.errors.length > 0) {
                    setToast({ message: payload.errors[0], type: 'error' });
                    hasError = true;
                  }

                  if (!hasError && payload?.record) {
                    // Success! Show success message and reset
                    setToast({
                      message: `Added "${selected.title}" by ${selected.artist} to your collection`,
                      type: 'success',
                    });
                    setSelectedAlbumId(null);
                    setAlbums([]);
                    setBarcode('');
                    // Notify parent to refresh stats
                    onRecordAdded?.();
                  }
                } catch (err: any) {
                  setToast({
                    message: err?.message ?? 'Failed to add record to collection',
                    type: 'error',
                  });
                } finally {
                  setIsLoading(false);
                }
              }}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg font-medium flex-shrink-0 transition-colors"
            >
              {isLoading ? 'Adding...' : 'Add to Collection'}
            </button>
          </div>
        </div>
      )}

      {/* Spacer to prevent content from being hidden behind the fixed button */}
      {selectedAlbumId && <div className="h-20 md:h-16" />}

      {/* Toast notification */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

export default ScanBarcode;
