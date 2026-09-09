import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { findUldInText, parseUldToken } from '../lib/uld';
import type { RootStackParamList, ScanRecord } from '../types';

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
async function recognizeText(uri: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    const { recognize } = await import('tesseract.js');
    const result = await recognize(uri, 'eng');
    return result.data.text;
  }
  const TextRecognition = loadTextRecognizer();
  if (!TextRecognition) return null;
  const result = await TextRecognition.recognize(uri);
  return result.text;
}

function makeRecord(partial: Omit<ScanRecord, 'id' | 'timestamp' | 'manuallyEdited'>): ScanRecord {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    manuallyEdited: false,
    ...partial,
  };
}

export default function ScannerScreen({ navigation }: Props) {
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
        Alert.alert(
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

      const record = makeRecord({ imageUri: photo.uri, rawText: text, uld });
      navigation.navigate('Result', { record });
    } catch (err) {
      Alert.alert('Scan failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Camera access unavailable',
          result.canAskAgain === false
            ? 'Camera permission was denied. Enable it in your browser/system settings, or use "Enter manually" below.'
            : 'Camera access was not granted. Use "Enter manually" below to try the rest of the app.',
        );
      }
    } catch (err) {
      Alert.alert(
        'Camera access unavailable',
        `This environment blocked camera access (${err instanceof Error ? err.message : String(err)}). ` +
          'Use "Enter manually" below to try the rest of the app.',
      );
    }
  };

  const submitManual = () => {
    const uld = parseUldToken(manualText);
    if (!uld) {
      Alert.alert('Not a ULD code', 'Expected format: 3 letters + 4-5 digits + 2-3 letters, e.g. AKE12345LH.');
      return;
    }
    setManualVisible(false);
    setManualText('');
    navigation.navigate('Result', {
      record: makeRecord({ imageUri: null, rawText: manualText, uld }),
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
        <Text style={styles.permissionText}>
          Camera access is needed to scan ULD ID placards.
        </Text>
        <Pressable style={styles.primaryButton} onPress={handleRequestPermission}>
          <Text style={styles.primaryButtonText}>Grant camera permission</Text>
        </Pressable>
        <Pressable style={[styles.secondaryButton, styles.darkSecondaryButton]} onPress={() => setManualVisible(true)}>
          <Text style={styles.darkSecondaryButtonText}>Enter manually instead</Text>
        </Pressable>
        {manualEntryModal}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <ScanFrameOverlay
        hint={busy ? 'Reading photo…' : 'Align the ULD ID label (e.g. AKE12345LH) inside the frame'}
      />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <Pressable style={styles.iconButton} onPress={() => setTorch((t) => !t)}>
          <Text style={styles.iconButtonText}>{torch ? 'Torch on' : 'Torch off'}</Text>
        </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  permissionText: { textAlign: 'center', fontSize: 16, color: '#1F2937' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iconButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'white' },
  secondaryButton: {
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  secondaryButtonText: { color: 'white', fontSize: 13, fontWeight: '600' },
  darkSecondaryButton: { backgroundColor: '#E5E7EB' },
  darkSecondaryButtonText: { color: '#111827', fontSize: 13, fontWeight: '600' },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { backgroundColor: 'white', borderRadius: 12, padding: 20, width: '100%', gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 1,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalButton: { minWidth: 0 },
});
