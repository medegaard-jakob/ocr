import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Dims everything outside a centered guide rectangle and labels it, to help
 * the user frame the ULD placard the way a real scanning UI would.
 */
export default function ScanFrameOverlay({ hint, accentColor = '#4ADE80' }: { hint: string; accentColor?: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.dim} />
      <View style={styles.middleRow}>
        <View style={styles.dim} />
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL, { borderColor: accentColor }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: accentColor }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: accentColor }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: accentColor }]} />
        </View>
        <View style={styles.dim} />
      </View>
      <View style={styles.dim}>
        <Text style={styles.hint}>{hint}</Text>
      </View>
    </View>
  );
}

const CORNER = 28;
const BORDER = 4;

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
  },
  middleRow: {
    flexDirection: 'row',
    height: 140,
  },
  frame: {
    width: 300,
    height: 140,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: BORDER, borderLeftWidth: BORDER },
  cornerTR: { top: 0, right: 0, borderTopWidth: BORDER, borderRightWidth: BORDER },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: BORDER, borderLeftWidth: BORDER },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER },
  hint: {
    color: 'white',
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
