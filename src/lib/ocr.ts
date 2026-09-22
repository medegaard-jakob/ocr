/**
 * Capturing a frame and reading text off it. Lifted out of the scanner screen
 * unchanged so the second, continuous scanner can run the same pipeline --
 * notably the Tesseract worker below, which is created once and reused: two
 * screens each holding their own would mean two WASM cores loaded.
 */

import { Platform } from 'react-native';
import type { CameraView } from 'expo-camera';
import React from 'react';

// expo-camera's zoom prop ranges 0 (no zoom, widest field of view) to 1 (max
// zoom). On web specifically, passing the literal 0 never actually reaches
// the camera track -- expo-camera's web implementation treats a falsy zoom
// value as "no change requested" and just leaves whatever zoom level the
// browser/device happened to open the camera stream at, which on many phones
// is already zoomed in well past 1x. A value that's effectively zero but not
// literally 0 clears that bug and forces the track to the minimum (widest)
// zoom, which is what actually fixes having to stand unnaturally far back to
// fit a placard in frame. Shared by both scanner screens so their camera
// preview always frames the same way.
export const MIN_ZOOM = 0.01;

// The OCR engine (@react-native-ml-kit/text-recognition) is native code and
// is not present in Expo Go. It only works in a custom dev-client / release
// build. We probe for it lazily so the rest of the app still runs in Expo Go
// for UI development, with "Enter manually" as a fallback scanning path.
function loadTextRecognizer(): typeof import('@react-native-ml-kit/text-recognition').default | null {
  try {
    return require('@react-native-ml-kit/text-recognition').default;
  } catch {
    return null;
  }
}

// On web there's no native module to load -- Tesseract.js runs OCR entirely
// client-side (WASM), so it's always available there. Returns null only on
// native platforms without a dev-client build (ML Kit not linked).
//
// A ULD code is only ever [A-Z0-9], and it's usually one isolated block of
// text on a label that also carries a barcode, airline logo, and other
// printed clutter. Tesseract's defaults are tuned for reading full pages of
// prose, not that -- so we whitelist the character set (misreads can only
// ever land on a letter/digit, never stray punctuation) and switch to
// SPARSE_TEXT page segmentation (built for finding isolated blocks of text
// scattered in an image, rather than assuming one uniform paragraph).
// The worker is created once and reused across scans in a ride instead of
// re-initializing (and re-downloading the WASM core) on every capture.
let webWorkerPromise: ReturnType<typeof import('tesseract.js').createWorker> | null = null;

async function getWebOcrWorker() {
  if (!webWorkerPromise) {
    webWorkerPromise = (async () => {
      const { createWorker, PSM } = await import('tesseract.js');
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      return worker;
    })();
  }
  return webWorkerPromise;
}

async function recognizeText(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const worker = await getWebOcrWorker();
    const result = await worker.recognize(uri);
    return result.data.text;
  }
  const TextRecognition = loadTextRecognizer();
  if (!TextRecognition) return null;
  const result = await TextRecognition.recognize(uri);
  return result.text;
}

// Web camera captures return a full-resolution base64 data: URI. Storing
// that as-is quickly blows the ~5-10MB localStorage quota that
// AsyncStorage's web shim writes to (one photo can be several MB), which
// makes the *next* save -- e.g. confirming a driver assignment -- fail
// silently. Shrink to a small thumbnail before it ever reaches storage;
// OCR already ran on the full-res original by the time this is called.
function downscaleDataUrl(dataUrl: string, maxSide = 480, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Could not downscale captured image'));
    img.src = dataUrl;
  });
}

// One capture-and-recognize pass, shared by both the manual shutter and the
// auto-scan loop below. Downscaling *before* OCR (not just before storage)
// keeps each Tesseract pass fast enough to run repeatedly -- a ULD code is
// large printed text, so it stays readable well below full sensor
// resolution -- and the same downscaled image doubles as the stored
// thumbnail, so there's no second resize pass needed later.
export async function captureFrame(
  cameraRef: React.RefObject<CameraView | null>,
  quality: number,
): Promise<{ uri: string; text: string } | null> {
  if (!cameraRef.current) return null;
  const photo = await cameraRef.current.takePictureAsync({ quality });
  if (!photo) return null;

  let uri = photo.uri;
  if (Platform.OS === 'web') {
    try {
      uri = await downscaleDataUrl(photo.uri, 640, 0.7);
    } catch {
      // Fall back to the full-res capture; slower, but still correct.
    }
  }

  const text = await recognizeText(uri);
  return text === null ? null : { uri, text };
}
