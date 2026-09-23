/**
 * A second, slower barcode-detection pass for codes the live camera stream
 * scan (expo-camera's built-in onBarcodeScanned, running continuously
 * against the low-resolution preview stream) can't catch -- a damaged,
 * faded, or glare-affected barcode.
 *
 * This runs on a captured photo instead (typically a meaningfully higher
 * resolution than the live preview) and contrast-stretches it before
 * detection, both of which give a decoder more to work with on a degraded
 * code. Torn or missing bars are the one kind of damage no amount of image
 * processing can recover -- that's data that's actually gone, not noise
 * sitting on top of data that's still there.
 *
 * Web only, same as the OCR pipeline in ocr.ts -- native platforms already
 * get continuous barcode detection from expo-camera's own ML Kit/
 * AVFoundation integration, at full camera resolution, with no equivalent
 * gap to fill here.
 */

import { Platform } from 'react-native';

export interface BarcodeReadResult {
  data: string;
  type: string;
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<{ format: string; rawValue: string }[]>;
};

// Browser-native format names for the Barcode Detection API, matching the
// same symbologies BarcodeScannerScreen requests from expo-camera's own
// live detector (see ULD_BARCODE_TYPES there for why this list is as wide
// as it is).
const WEB_FORMATS = ['code_128', 'code_39', 'code_93', 'itf', 'codabar', 'ean_13', 'ean_8', 'upc_a', 'upc_e'];

let cachedDetector: BarcodeDetectorLike | null = null;

async function getDetector(): Promise<BarcodeDetectorLike> {
  if (cachedDetector) return cachedDetector;
  const NativeBarcodeDetector = (globalThis as any).BarcodeDetector;
  const detector: BarcodeDetectorLike =
    typeof NativeBarcodeDetector !== 'undefined'
      ? new NativeBarcodeDetector({ formats: WEB_FORMATS })
      // Same polyfill expo-camera's own web barcode scanner falls back to
      // -- already a project dependency, not something newly introduced here.
      : new (await import('barcode-detector')).BarcodeDetector({ formats: WEB_FORMATS as any });
  cachedDetector = detector;
  return detector;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load captured image'));
    img.src = uri;
  });
}

// Grayscale, then stretch whatever range of brightness is actually present
// in the frame back out to the full 0-255 range. A barcode decoder reads
// edges between light and dark bars; a faded label or a glare hit has
// already lost a lot of that contrast by the time it reaches the camera, so
// this restores as much of the edge strength as the frame still has.
function contrastStretch(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const pixelCount = data.length / 4;

  const gray = new Uint8ClampedArray(pixelCount);
  let min = 255;
  let max = 0;
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const g = data[o] * 0.299 + data[o + 1] * 0.587 + data[o + 2] * 0.114;
    gray[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = Math.max(1, max - min);
  for (let i = 0; i < pixelCount; i++) {
    const stretched = ((gray[i] - min) / range) * 255;
    const o = i * 4;
    data[o] = data[o + 1] = data[o + 2] = stretched;
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Attempts a barcode read from a captured photo URI, after grayscaling and
 * contrast-stretching it. Returns null if nothing decodes -- not every
 * attempt is expected to find a code, same as the live scanner.
 */
export async function readBarcodeFromUri(uri: string): Promise<BarcodeReadResult | null> {
  if (Platform.OS !== 'web') return null;

  const img = await loadImage(uri);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0);
  contrastStretch(ctx, canvas.width, canvas.height);

  const detector = await getDetector();
  const results = await detector.detect(canvas);
  if (results.length === 0) return null;
  return { data: results[0].rawValue, type: results[0].format };
}
