import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScanFrameOverlay from '../components/ScanFrameOverlay';
import { showAlert } from '../lib/alert';
import { colors } from '../lib/theme';
import { findUldInText, parseUldToken } from '../lib/uld';
import { MAX_ULDS_PER_RIDE, type RootStackParamList, type UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

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

export default function ScannerScreen({ navigation, route }: Props) {
  const ride = route.params?.ride ?? [];
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualText, setManualText] = useState('');
  const cameraRef = useRef<CameraView>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) throw new Error('Camera did not return a photo.');

      const text = await recognizeText(photo.uri);
      if (text === null) {
        showAlert(
          'OCR unavailable in this build',
          'On-device text recognition needs a custom dev-client or release build ' +
            '(it uses a native module that Expo Go cannot load). Run "npx expo prebuild" ' +
            'and build a dev client to test scanning on a device, or use "Enter manually" ' +
            'below to try the rest of the app now.',
        );
        return;
      }

      const uld = findUldInText(text);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(
          uld ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        );
      }

      let imageUri = photo.uri;
      if (Platform.OS === 'web') {
        try {
          imageUri = await downscaleDataUrl(photo.uri);
        } catch {
          // Fall back to the full-res capture; storage may still reject it
          // later, but that's no worse than skipping the shrink entirely.
        }
      }

      const entry: UldEntry = { imageUri, rawText: text, uld, manuallyEdited: false };
      navigation.navigate('Result', { entry, ride });
    } catch (err) {
      showAlert('Scan failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const goHome = () => {
    if (ride.length > 0) {
      showAlert(
        'Leave this ride?',
        `${ride.length} ULD${ride.length > 1 ? 's' : ''} scanned so far will be discarded.`,
        [
          { text: 'Keep scanning', style: 'cancel' },
          { text: 'Discard & leave', style: 'destructive', onPress: () => navigation.navigate('Home') },
        ],
      );
    } else {
      navigation.navigate('Home');
    }
  };

  const handleRequestPermission = async () => {
    try {
      const result = await requestPermission();
      if (!result.granted) {
        showAlert(
          'Camera access unavailable',
          result.canAskAgain === false
            ? 'Camera permission was denied. Enable it in your browser/system settings, or use "Enter manually" below.'
            : 'Camera access was not granted. Use "Enter manually" below to try the rest of the app.',
        );
      }
    } catch (err) {
      showAlert(
        'Camera access unavailable',
        `This environment blocked camera access (${err instanceof Error ? err.message : String(err)}). ` +
          'Use "Enter manually" below to try the rest of the app.',
      );
    }
  };

  const submitManual = () => {
    const uld = parseUldToken(manualText);
    if (!uld) {
      showAlert('Not a ULD code', 'Expected format: 3 letters + 4-5 digits + 2-3 letters, e.g. AKE12345LH.');
      return;
    }
    setManualVisible(false);
    setManualText('');
    navigation.navigate('Result', {
      entry: { imageUri: null, rawText: manualText, uld, manuallyEdited: false },
      ride,
    });
  };

  const manualEntryModal = (
    <Modal visible={manualVisible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Enter ULD ID</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="AKE12345LH"
            autoCapitalize="characters"
            autoCorrect={false}
            value={manualText}
            onChangeText={setManualText}
          />
          <View style={styles.modalRow}>
            <Pressable
              style={[styles.secondaryButton, styles.modalButton]}
              onPress={() => {
                setManualVisible(false);
                setManualText('');
              }}
            >
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.modalButton]} onPress={submitManual}>
              <Text style={styles.primaryButtonText}>Use code</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Pressable style={styles.backButtonTop} onPress={goHome}>
          <Text style={styles.backButtonTopText}>← Back</Text>
        </Pressable>
        <Text style={styles.permissionText}>
          Camera access is needed to scan ULD ID placards.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleRequestPermission}>
          <Text style={styles.primaryButtonText}>Grant camera permission</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setManualVisible(true)}>
          <Text style={styles.secondaryButtonText}>Enter manually instead</Text>
        </Pressable>
        {manualEntryModal}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <ScanFrameOverlay
        hint={
          busy
            ? 'Reading photo…'
            : ride.length > 0
              ? `Scan ULD ${ride.length + 1} for this ride (${ride.length}/${MAX_ULDS_PER_RIDE} added)`
              : 'Align the ULD ID label (e.g. AKE12345LH) inside the frame'
        }
      />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topBarLeft}>
          <Pressable style={styles.iconButton} onPress={goHome}>
            <Text style={styles.iconButtonText}>← Back</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.iconButtonText}>{torch ? 'Torch on' : 'Torch off'}</Text>
          </Pressable>
        </View>
        {ride.length > 0 && (
          <View style={styles.rideBadge}>
            <Text style={styles.rideBadgeText}>
              Ride: {ride.length}/{MAX_ULDS_PER_RIDE}
            </Text>
          </View>
        )}
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('History')}>
          <Text style={styles.iconButtonText}>History</Text>
        </Pressable>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <Pressable style={styles.secondaryButton} onPress={() => setManualVisible(true)}>
          <Text style={styles.secondaryButtonText}>Enter manually</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={handleCapture} disabled={busy}>
          {busy ? <ActivityIndicator color="white" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <View style={styles.secondaryButton} />
      </SafeAreaView>

      {manualEntryModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: colors.bg },
  permissionText: { textAlign: 'center', fontSize: 20, color: colors.textPrimary },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  topBarLeft: { flexDirection: 'row', gap: 8 },
  backButtonTop: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 4 },
  backButtonTopText: { color: colors.accent, fontSize: 18, fontWeight: '600' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 10,
  },
  iconButtonText: { color: 'white', fontSize: 17, fontWeight: '600' },
  rideBadge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 10,
  },
  rideBadgeText: { color: 'white', fontSize: 17, fontWeight: '700' },
  shutter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 5,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'white' },
  secondaryButton: {
    minWidth: 112,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  secondaryButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.accentDeep,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: { color: 'white', fontSize: 18, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 19,
    letterSpacing: 1,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceAlt,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalButton: { minWidth: 0 },
});
