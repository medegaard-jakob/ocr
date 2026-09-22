import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScanFrameOverlay from '../components/ScanFrameOverlay';
import { MIN_ZOOM } from '../lib/ocr';
import { loadHistory } from '../lib/storage';
import { colors } from '../lib/theme';
import { parseUldToken } from '../lib/uld';
import { useCameraAccess } from '../lib/useCameraAccess';
import { MAX_ULDS_PER_RIDE, type RootStackParamList, type UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BarcodeScanner'>;

/** How long the confirmation of a read stays on screen. */
const FLASH_MS = 1200;

/** Ignore repeat detections of the same barcode within this window -- the
 *  detector fires on every frame the code is visible in, not once per code,
 *  so without this the same placard held steady would add duplicates. */
const RESCAN_COOLDOWN_MS = 2000;

// ULD ID labels print their code as both text and a 1D barcode. Code 128 and
// Code 39 are what's actually shown up on the labels tried so far; Code 93
// and ITF are close relatives sometimes used for the same purpose, included
// so a different operator's label isn't silently unreadable.
const ULD_BARCODE_TYPES = ['code128', 'code39', 'code93', 'itf14'] as const;

type Flash =
  | { kind: 'added'; code: string }
  | { kind: 'duplicate'; code: string }
  | { kind: 'conflict'; code: string };

/**
 * The experimental "Make task - C" scanner: read the placard's printed
 * barcode instead of running OCR on the text next to it. Barcode detection
 * is built into expo-camera's CameraView itself (native BarcodeDetector on
 * web, ML Kit/AVFoundation on native) -- unlike the OCR flows, it needs no
 * separate engine, no custom dev-client build, and a decode is either a
 * clean hit or nothing at all, with no OCR-confusion corrections and no
 * two-reads-agree consensus to wait on.
 *
 * Shares its running-list-then-review shape with Make task - B (scan
 * continuously, confirm what to keep on ScanReview afterward) since that
 * part has nothing to do with how each code was read.
 */
export default function BarcodeScannerScreen({ navigation }: Props) {
  const { permission, resolved: accessResolved, asking, ask } = useCameraAccess();
  const [torch, setTorch] = useState(false);
  const [entries, setEntries] = useState<UldEntry[]>([]);
  const [flash, setFlash] = useState<Flash | null>(null);

  // ULD codes already carried by a task that hasn't been resolved yet -- see
  // ContinuousScannerScreen for why this is worth surfacing but not enforcing.
  const [openTaskCodes, setOpenTaskCodes] = useState<Set<string>>(new Set());

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The list as onBarcodeScanned sees it -- state alone would go stale
  // inside that closure between renders.
  const entriesRef = useRef<UldEntry[]>([]);
  const lastReadRef = useRef<{ code: string; at: number } | null>(null);
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

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    const data = result.data.trim();
    const now = Date.now();
    if (lastReadRef.current && lastReadRef.current.code === data && now - lastReadRef.current.at < RESCAN_COOLDOWN_MS) {
      return;
    }
    lastReadRef.current = { code: data, at: now };

    const uld = parseUldToken(data);
    // Not every barcode in frame is a ULD tag -- a shipping label, a barcode
    // on nearby equipment. Silently not what we're looking for, not an error.
    if (!uld) return;

    if (entriesRef.current.some((e) => e.uld?.code === uld.code)) {
      showFlash({ kind: 'duplicate', code: uld.code });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    const entry: UldEntry = { imageUri: null, rawText: data, uld, manuallyEdited: false };
    const next = [...entriesRef.current, entry];
    entriesRef.current = next;
    setEntries(next);

    const conflict = openTaskCodes.has(uld.code);
    showFlash({ kind: conflict ? 'conflict' : 'added', code: uld.code });
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(
        conflict ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
      );
    }
  };

  const hint = (() => {
    if (full) return `${MAX_ULDS_PER_RIDE} ULDs on this task — tap Done to review`;
    if (flash?.kind === 'added') return `${flash.code} added`;
    if (flash?.kind === 'duplicate') return `${flash.code} is already on this task`;
    if (flash?.kind === 'conflict') return `${flash.code} added — it's on another open task`;
    return entries.length > 0
      ? 'Keep scanning — each new barcode is added automatically'
      : 'Align the barcode on the ULD ID label inside the frame';
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
            : 'Camera access is needed to scan ULD barcodes.'}
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
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        zoom={MIN_ZOOM}
        barcodeScannerSettings={{ barcodeTypes: [...ULD_BARCODE_TYPES] }}
        onBarcodeScanned={full || !isFocused ? undefined : onBarcodeScanned}
      />
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
          leaving the camera -- same as Make task - B. */}
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
          style={[styles.doneButton, entries.length === 0 && styles.doneButtonDisabled]}
          onPress={() => navigation.navigate('ScanReview', { entries })}
          disabled={entries.length === 0}
        >
          <Text style={styles.doneButtonText}>
            {entries.length === 0 ? 'Point at a barcode to start' : `Done (${entries.length})`}
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
    bottom: 110,
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  doneButton: {
    backgroundColor: colors.accentDeep,
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: 'center',
  },
  doneButtonDisabled: { opacity: 0.45 },
  doneButtonText: { color: 'white', fontWeight: '700', fontSize: 19 },
});
