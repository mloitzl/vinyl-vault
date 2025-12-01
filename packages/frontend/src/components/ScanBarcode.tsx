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

  const lookup = useCallback(async (bc: string) => {
    setIsLoading(true);
    setErrors([]);
    setResults([]);

    // BFF exposes `scanBarcode` mutation. Call the BFF GraphQL endpoint.
    const query = `mutation Scan($barcode: String!) { scanBarcode(barcode: $barcode) { releases { id barcode artist title year format label country coverImageUrl source } errors } }`;

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

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const BarcodeDetector = (window as any).BarcodeDetector;
      if (BarcodeDetector) {
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
              const code = detections[0].rawValue;
              setBarcode(code);
              stopCamera();
              lookup(code);
              return;
            }
          } catch (err) {
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

          // decodeFromVideoDevice will continuously scan and call the callback on results
          // passing `undefined` as deviceId lets the browser pick the default camera
          reader.decodeFromVideoDevice(
            undefined,
            videoRef.current as HTMLVideoElement,
            (result) => {
              if (result) {
                const code = result.getText();
                setBarcode(code);
                stopCamera();
                lookup(code);
              }
              // ignore errors (NotFoundException) and continue scanning
            }
          );
        } catch (err: any) {
          setErrors((s) => [...s, 'Barcode detection not available in this browser.']);
          scanningRef.current = false;
        }
      }
    } catch (err: any) {
      setErrors([err?.message ?? String(err)]);
      scanningRef.current = false;
    }
  }, [lookup]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    try {
      if (zxingRef.current) {
        try {
          (zxingRef.current as any)?.reset?.();
        } catch (_) {
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
    } catch (_) {
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
                <div>
                  <div className="font-semibold">
                    {r.artist} — {r.title}
                  </div>
                  <div className="text-sm text-gray-500">
                    {r.label ?? ''} {r.year ? `· ${r.year}` : ''} {r.source ? `· ${r.source}` : ''}
                  </div>
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
