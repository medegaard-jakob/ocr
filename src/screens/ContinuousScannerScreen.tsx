import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScanFrameOverlay from '../components/ScanFrameOverlay';
import { captureFrame } from '../lib/ocr';
import { loadHistory } from '../lib/storage';
import { colors } from '../lib/theme';
import { findUldInText } from '../lib/uld';
import { useCameraAccess } from '../lib/useCameraAccess';
import { MAX_ULDS_PER_RIDE, type RootStackParamList, type UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ContinuousScanner'>;

/** How long the confirmation of a read stays on screen. */
const FLASH_MS = 1200;

type Flash =
  | { kind: 'added'; code: string }
  | { kind: 'duplicate'; code: string }
  | { kind: 'conflict'; code: string };

/**
 * The experimental "Make task - B" scanner: stay in the camera and collect
 * ULDs as they're read, instead of bouncing out to a result screen and back
 * for each one. Nothing here replaces the original flow -- both are on Home
 * so they can be tried against each other.
 *
 * Reads go straight into a running list with a buzz and a flash rather than
 * asking for confirmation each time; the single review screen after "Done"
 * is where anything wrong gets dropped.
 */
export default function ContinuousScannerScreen({ navigation }: Props) {
  const { permission, resolved: accessResolved, asking, ask } = useCameraAccess();
  const [torch, setTorch] = useState(false);
  const [entries, setEntries] = useState<UldEntry[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [scanning, setScanning] = useState(false);

  // ULD codes already carried by a task that hasn't been resolved yet. A ULD
  // belongs to one task at a time, so seeing one here means it's still open
  // somewhere else -- worth saying out loud, though not worth refusing: the
  // supervisor can see the physical ULD and we can't.
  const [openTaskCodes, setOpenTaskCodes] = useState<Set<string>>(new Set());

  const cameraRef = useRef<CameraView>(null);
  const scanningRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The list as the scan loop sees it. State alone would go stale inside the
  // interval's closure, and a duplicate check that lags by one frame is the
  // whole bug it exists to prevent.
  const entriesRef = useRef<UldEntry[]>([]);
  const candidateRef = useRef<string | null>(null);
  const isFocused = useIsFocused();

  const full = entries.length >= MAX_ULDS_PER_RIDE;

  useEffect(() => {
    loadHistory().then((records) => {
      const codes = new Set<string>();
      for (const record of records) {
        if (record.resolvedAt) continue;
        for (const uld of record.ulds) {
          if (uld.uld) codes.add(uld.uld.code);
        }
      }
      setOpenTaskCodes(codes);
    });
  }, []);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const showFlash = (next: Flash) => {
    setFlash(next);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  };

  const addEntry = (entry: UldEntry, code: string) => {
    // Already caught this session: the same placard drifting back into frame,
    // which is the normal way this happens. Say so, but don't add it twice.
    if (entriesRef.current.some((e) => e.uld?.code === code)) {
      showFlash({ kind: 'duplicate', code });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    const next = [...entriesRef.current, entry];
    entriesRef.current = next;
    setEntries(next);

    const conflict = openTaskCodes.has(code);
    showFlash({ kind: conflict ? 'conflict' : 'added', code });
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(
        conflict ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
      );
    }
  };

  /** One capture-and-read pass, shared by the auto loop and the shutter. */
  const scanOnce = async (quality: number): Promise<'hit' | 'miss' | 'unavailable'> => {
    const result = await captureFrame(cameraRef, quality);
    if (!result) return 'unavailable';
    const uld = findUldInText(result.text);
    if (!uld) {
      candidateRef.current = null;
      return 'miss';
    }

    // Same two-reads-agree rule the original scanner uses: one blurry frame
    // can't inject a wrong code on its own. It matters more here, not less --
    // nobody confirms each read, and a plausible-looking misread would sail
    // through the review screen unnoticed.
    if (candidateRef.current !== uld.code) {
      candidateRef.current = uld.code;
      return 'miss';
    }
    candidateRef.current = null;

    addEntry(
      { imageUri: result.uri, rawText: result.text, uld, manuallyEdited: false },
      uld.code,
    );
    return 'hit';
  };

  // Web is the only platform with OCR available without a dev-client build,
  // so it's the only one that can read continuously; on native the shutter
  // below does the same job a tap at a time, still without leaving the camera.
  useEffect(() => {
    if (Platform.OS !== 'web' || !permission?.granted || !isFocused || full) return;

    const id = setInterval(async () => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      try {
        await scanOnce(0.5);
      } catch {
        // A single failed frame just gets retried on the next tick.
      } finally {
        scanningRef.current = false;
      }
    }, 900);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted, isFocused, full, openTaskCodes]);

  const onShutter = async () => {
    if (scanningRef.current || full) return;
    scanningRef.current = true;
    setScanning(true);
    try {
      await scanOnce(0.8);
    } catch {
      // Same as the loop: a bad frame is just a miss, try again.
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  };

  const hint = (() => {
    if (full) return `${MAX_ULDS_PER_RIDE} ULDs on this task — tap Done to review`;
    if (flash?.kind === 'added') return `${flash.code} added`;
    if (flash?.kind === 'duplicate') return `${flash.code} is already on this task`;
    if (flash?.kind === 'conflict') return `${flash.code} added — it's on another open task`;
    if (candidateRef.current) return 'Got a possible match — hold steady…';
    return entries.length > 0
      ? 'Keep scanning — each new ULD is added automatically'
      : 'Align the ULD ID label (e.g. AKE12345LH) inside the frame';
  })();

  const frameColor = flash
    ? flash.kind === 'added'
      ? colors.success
      : colors.warning
    : undefined;

  if (!permission || !accessResolved || asking) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <SafeAreaView style={styles.center}>
        <Pressable style={styles.backButtonTop} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.backButtonTopText}>← Back</Text>
        </Pressable>
        <Text style={styles.permissionText}>
          {blocked
            ? 'Camera access is blocked for this site. Turn it back on in your browser settings to scan.'
            : 'Camera access is needed to scan ULD ID placards.'}
        </Text>
        {!blocked && (
          <Pressable style={styles.primaryButton} onPress={() => ask(true)}>
            <Text style={styles.primaryButtonText}>Grant camera permission</Text>
          </Pressable>
        )}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} />
      <ScanFrameOverlay accentColor={frameColor} hint={hint} />

      <SafeAreaView style={styles.topBar} edges={['top']}>
        <View style={styles.topBarLeft}>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Home')}>
            <Text style={styles.iconButtonText}>← Back</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setTorch((t) => !t)}>
            <Text style={styles.iconButtonText}>{torch ? 'Torch on' : 'Torch off'}</Text>
          </Pressable>
        </View>
        <View style={[styles.countBadge, full && styles.countBadgeFull]}>
          <Text style={styles.countBadgeText}>
            {entries.length}/{MAX_ULDS_PER_RIDE}
          </Text>
        </View>
      </SafeAreaView>

      {/* The running list, so it's obvious what has been caught without
          leaving the camera -- the whole point of staying here. */}
      {entries.length > 0 && (
        <SafeAreaView style={styles.caughtStrip} edges={[]}>
          {entries.map((entry, i) => (
            <View key={i} style={styles.caughtChip}>
              <Text style={styles.caughtChipText}>{entry.uld?.code}</Text>
            </View>
          ))}
        </SafeAreaView>
      )}

      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        <Pressable
          style={[styles.shutter, full && styles.shutterDisabled]}
          onPress={onShutter}
          disabled={scanning || full}
        >
          {scanning ? <ActivityIndicator color="white" /> : <View style={styles.shutterInner} />}
        </Pressable>
        <Pressable
          style={[styles.doneButton, entries.length === 0 && styles.doneButtonDisabled]}
          onPress={() => navigation.navigate('ScanReview', { entries })}
          disabled={entries.length === 0}
        >
          <Text style={styles.doneButtonText}>
            {entries.length === 0 ? 'Done' : `Done (${entries.length})`}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  backButtonTop: { position: 'absolute', top: 16, left: 16, padding: 10 },
  backButtonTopText: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  permissionText: { textAlign: 'center', fontSize: 20, color: colors.textPrimary },
  primaryButton: { backgroundColor: colors.accentDeep, borderRadius: 10, paddingVertical: 18, paddingHorizontal: 28 },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 18 },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { paddingVertical: 10, paddingHorizontal: 12 },
  iconButtonText: { color: 'white', fontSize: 15, fontWeight: '600' },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  countBadgeFull: { backgroundColor: colors.accentDeep, borderColor: colors.accent },
  countBadgeText: { color: 'white', fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },

  caughtStrip: {
    pointerEvents: 'none',
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 150,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  caughtChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  caughtChipText: { color: 'white', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 16,
  },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'white' },
  doneButton: {
    flex: 1,
    backgroundColor: colors.accentDeep,
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: 'center',
  },
  doneButtonDisabled: { opacity: 0.45 },
  doneButtonText: { color: 'white', fontWeight: '700', fontSize: 19 },
});
