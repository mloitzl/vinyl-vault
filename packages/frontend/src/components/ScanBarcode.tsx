import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowserMultiFormatReader } from '@zxing/browser';
import { BrowserMultiFormatReader as ZXingBrowserMultiFormatReader } from '@zxing/browser';

type ReleaseResult = {
  id: string;
  barcode: string;
  artist: string;
  title: string;
  year?: number | null;
  format?: string | null;
  label?: string | null;
  coverImageUrl?: string | null;
  externalId?: string | null;
  source?: string;
  genre?: string[];
  style?: string[];
  trackList?: { position?: string; title: string; duration?: string }[];
};

export function ScanBarcode() {
  const [barcode, setBarcode] = useState('0602475276197');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ReleaseResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const zxingRef = useRef<BrowserMultiFormatReader | null>(null);
  const detectedRef = useRef(false);

  const lookup = useCallback(async (bc: string) => {
    setIsLoading(true);
    setErrors([]);
    setResults([]);

    // BFF exposes `scanBarcode` mutation. Call the BFF GraphQL endpoint.
    const query = `mutation Scan($barcode: String!) { scanBarcode(barcode: $barcode) { releases { id barcode artist title year format label country coverImageUrl source genre style trackList { position title duration } } errors } }`;

    try {
      const res = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query, variables: { barcode: bc } }),
      });
      const body = await res.json();
      if (body.errors) {
        setErrors(body.errors.map((e: any) => e.message));
      } else {
        const payload = body.data?.scanBarcode;
        if (payload?.errors && payload.errors.length) setErrors(payload.errors);
        if (payload?.releases) setResults(payload.releases);
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
        <div className="flex gap-2">
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="flex-1 border rounded px-3 py-2"
            placeholder="Enter or scan barcode (e.g. 0123456789012)"
          />
          <button type="submit" className="bg-blue-600 text-white px-3 py-2 rounded">
            {isLoading ? 'Searching...' : 'Lookup'}
          </button>
          <button
            type="button"
            onClick={() => (scanningRef.current ? stopCamera() : startCamera())}
            className="bg-gray-200 px-3 py-2 rounded"
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

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((r, idx) => (
            <div key={idx} className="p-3 border rounded bg-white">
              <div className="flex items-center gap-3">
                {r.coverImageUrl ? (
                  <img
                    src={r.coverImageUrl}
                    alt={r.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                    📀
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {r.artist} — {r.title}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {r.label ?? ''} {r.year ? `· ${r.year}` : ''} {r.source ? `· ${r.source}` : ''}
                  </div>

                  {/* Genres and styles inline as small badges */}
                  {(r.genre && r.genre.length > 0) || (r.style && r.style.length > 0) ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.genre && r.genre.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.genre.map((g, gi) => (
                            <span
                              key={`g-${gi}`}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                      {r.style && r.style.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {r.style.map((s, si) => (
                            <span
                              key={`s-${si}`}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* Expanded track list (scrollable on mobile) */}
                  {r.trackList && r.trackList.length > 0 && (
                    <div className="mt-3 max-h-56 overflow-y-auto text-sm">
                      {r.trackList.map((t, ti) => (
                        <div key={ti} className="py-1 border-b last:border-b-0">
                          <div className="flex justify-between items-start gap-3">
                            <div className="text-xs text-gray-500 w-12 flex-shrink-0">
                              {t.position ?? ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate">{t.title}</div>
                            </div>
                            <div className="text-xs text-gray-500 ml-3 flex-shrink-0">
                              {t.duration ?? ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScanBarcode;
