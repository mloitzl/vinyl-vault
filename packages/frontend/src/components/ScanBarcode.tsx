import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserMultiFormatReader } from '@zxing/browser';
import { BrowserMultiFormatReader as ZXingBrowserMultiFormatReader } from '@zxing/browser';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { BarcodeInput } from './BarcodeInput';
import { AlbumCard } from './AlbumCard';
import { useScanBarcodeMutation, useCreateRecordMutation } from '../hooks/relay';
import { useToast } from '../contexts';

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
  const { addToast } = useToast();
  const [barcode, setBarcode] = useState('5099902988313');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [timing, setTiming] = useState<LookupTiming | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const { mutate: scanBarcode, isLoading: isScanning } = useScanBarcodeMutation();
  const { mutate: createRecord, isLoading: isCreating } = useCreateRecordMutation();
  const isLoading = isScanning || isCreating;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false);

  const lookup = useCallback(
    async (bc: string) => {
      setErrors([]);
      setAlbums([]);
      setTiming(null);
      setSelectedAlbumId(null);

      try {
        const result = (await scanBarcode(bc)) as any; // Type from mutation response
        if (result.albums) {
          setAlbums(result.albums);
        }
        if (result.timing) {
          setTiming(result.timing);
        }
        if (result.errors && result.errors.length > 0) {
          setErrors(result.errors);
        }
      } catch (err: any) {
        setErrors([err?.message ?? String(err)]);
      }
    },
    [scanBarcode]
  );

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

  const handleAddToCollection = async () => {
    const selected = albums.find((a) => a.id === selectedAlbumId);
    if (!selected) return;

    try {
      await createRecord({
        releaseId: selected.primaryRelease.release.id,
      });
      addToast(`Added "${selected.title}" by ${selected.artist} to your collection`, 'success');
      setSelectedAlbumId(null);
      setAlbums([]);
      setBarcode('');
      onRecordAdded?.();
    } catch (err: any) {
      addToast(err?.message ?? 'Failed to add record to collection', 'error');
    }
  };

  return (
    <div className="p-4">
      {/* Barcode input section */}
      <BarcodeInput
        value={barcode}
        onValueChange={setBarcode}
        onSubmit={onSubmit}
        isLoading={isLoading}
        isScanning={scanningRef.current}
        onStartCamera={startCamera}
        onStopCamera={stopCamera}
      />

      {/* Camera video feed */}
      <div className="mt-3">
        <video
          ref={videoRef}
          className="w-full rounded bg-black"
          style={{ maxHeight: 360 }}
          playsInline
        />
      </div>

      {/* Error alerts */}
      {errors.length > 0 && (
        <div className="mt-3 space-y-2">
          {errors.map((error, index) => (
            <Alert
              key={index}
              type="error"
              onDismiss={() => setErrors(errors.filter((_, i) => i !== index))}
            >
              {error}
            </Alert>
          ))}
        </div>
      )}

      {/* Lookup timing info */}
      {timing && (
        <div className="mt-3 text-xs text-gray-500">
          Found {albums.length} album{albums.length !== 1 ? 's' : ''} in {timing.totalMs}ms
        </div>
      )}

      {/* Albums list */}
      {albums.length > 0 && (
        <div className="mt-6 space-y-3">
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              isSelected={selectedAlbumId === album.id}
              onSelect={() => setSelectedAlbumId(selectedAlbumId === album.id ? null : album.id)}
            />
          ))}
        </div>
      )}

      {/* Add to collection action bar */}
      {selectedAlbumId && (
        <div className="fixed bottom-14 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4 md:max-w-none">
            {/* Selected album info */}
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

            {/* Add button */}
            <Button
              onClick={handleAddToCollection}
              disabled={isLoading}
              variant="primary"
              className="flex-shrink-0"
            >
              {isLoading ? 'Adding...' : 'Add to Collection'}
            </Button>
          </div>
        </div>
      )}

      {/* Spacer for fixed button */}
      {selectedAlbumId && <div className="h-20 md:h-16" />}
    </div>
  );
}

export default ScanBarcode;
