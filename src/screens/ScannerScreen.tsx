import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { CameraView } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
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
import { captureFrame } from '../lib/ocr';
import { useCameraAccess } from '../lib/useCameraAccess';
import { colors } from '../lib/theme';
import { findUldInText, parseUldToken } from '../lib/uld';
import { MAX_ULDS_PER_RIDE, type RootStackParamList, type UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export default function ScannerScreen({ navigation, route }: Props) {
  const ride = route.params?.ride ?? [];
  const { permission, resolved: accessResolved, asking, ask } = useCameraAccess();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualText, setManualText] = useState('');
  // 'scanning': no unconfirmed read yet. 'candidate': the last auto-scan
  // attempt found a valid code and is waiting to see the same code again
  // before trusting it -- a random misread almost never repeats itself.
  const [autoHint, setAutoHint] = useState<'scanning' | 'candidate'>('scanning');
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const autoBusyRef = useRef(false);
  const candidateRef = useRef<string | null>(null);
  const isFocused = useIsFocused();

  const handleCapture = async () => {
    if (!cameraRef.current || busy || autoBusyRef.current) return;
    setBusy(true);
    try {
      const result = await captureFrame(cameraRef, 0.8);
      if (!result) {
        showAlert(
          'OCR unavailable in this build',
          'On-device text recognition needs a custom dev-client or release build ' +
            '(it uses a native module that Expo Go cannot load). Run "npx expo prebuild" ' +
            'and build a dev client to test scanning on a device, or use "Enter manually" ' +
            'below to try the rest of the app now.',
        );
        return;
      }

      const uld = findUldInText(result.text);
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(
          uld ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        );
      }

      const entry: UldEntry = { imageUri: result.uri, rawText: result.text, uld, manuallyEdited: false };
      navigation.navigate('Result', { entry, ride });
    } catch (err) {
      showAlert('Scan failed', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Auto-scan: while the live camera is on screen (web only -- Tesseract is
  // the only OCR path that's actually available there), try a frame roughly
  // once a second. Two consecutive attempts have to agree on the exact same
  // code before it's trusted and auto-submitted, so one blurry/misread frame
  // can't wrongly commit you to a code -- it just gets silently discarded and
  // tried again. The manual shutter still works at any time as an override.
  useEffect(() => {
    if (Platform.OS !== 'web' || !permission?.granted || manualVisible || !isFocused) return;

    const id = setInterval(async () => {
      if (busyRef.current || autoBusyRef.current) return;
      autoBusyRef.current = true;
      try {
        const result = await captureFrame(cameraRef, 0.5);
        if (!result) return;
        const uld = findUldInText(result.text);
        if (!uld) {
          candidateRef.current = null;
          setAutoHint('scanning');
          return;
        }
        if (candidateRef.current === uld.code) {
          candidateRef.current = null;
          const entry: UldEntry = { imageUri: result.uri, rawText: result.text, uld, manuallyEdited: false };
          navigation.navigate('Result', { entry, ride });
          return;
        }
        candidateRef.current = uld.code;
        setAutoHint('candidate');
      } catch {
        // A single failed frame just gets retried on the next tick.
      } finally {
        autoBusyRef.current = false;
      }
    }, 900);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, manualVisible, isFocused]);

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

  // Nothing to show yet, or the browser's prompt is up: stay blank rather
  // than flashing the explainer for the moment it takes to resolve.
  if (!permission || !accessResolved || asking) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    // Blocked at the browser level -- asking again does nothing, so don't
    // offer a button that can't work. Say where the switch actually is.
    const blocked = !permission.canAskAgain;
    return (
      <SafeAreaView style={styles.center}>
        <Pressable style={styles.backButtonTop} onPress={goHome}>
          <Text style={styles.backButtonTopText}>← Back</Text>
        </Pressable>
        <Text style={styles.permissionText}>
          {blocked
            ? 'Camera access is blocked for this site. Turn it back on in your browser settings to scan, or enter the code by hand.'
            : 'Camera access is needed to scan ULD ID placards.'}
        </Text>
        {!blocked && (
          <Pressable style={styles.primaryButton} onPress={() => ask(true)}>
            <Text style={styles.primaryButtonText}>Grant camera permission</Text>
          </Pressable>
        )}
        <Pressable
          style={blocked ? styles.primaryButton : styles.secondaryButton}
          onPress={() => setManualVisible(true)}
        >
          <Text style={blocked ? styles.primaryButtonText : styles.secondaryButtonText}>
            Enter manually instead
          </Text>
        </Pressable>
        {manualEntryModal}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <ScanFrameOverlay
        accentColor={!busy && autoHint === 'candidate' ? colors.warning : undefined}
        hint={
          busy
            ? 'Reading photo…'
            : autoHint === 'candidate'
              ? 'Got a possible match — hold steady…'
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
