import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';
import type { UldStage } from '../lib/flights';
import TractorIcon from './TractorIcon';

/**
 * The six handling-stage marks on a flight card, drawn from View primitives
 * like the app's other icons (the one exception is the aircraft, where the ✈
 * glyph reads better at this size than anything assembled from boxes -- the
 * screens already use ‹ → ⚠ the same way).
 *
 * Every mark takes its color from the caller so a stage can go green when
 * delivered or orange when at risk, rather than each icon deciding for
 * itself. `background` is whatever surface the icon sits on; the shapes that
 * need to look cut out or hollow fill against it.
 */
export default function UldStageIcon({
  stage,
  color,
  background = colors.bg,
}: {
  stage: UldStage;
  color: string;
  background?: string;
}) {
  switch (stage) {
    // A plain, unmarked ULD: we know it belongs to the flight, nothing more.
    case 'unknown':
      return (
        <View style={styles.frame}>
          <View style={[styles.uldBox, { borderColor: color }]} />
        </View>
      );

    // The contoured LD3 profile -- outline only, so it reads as an empty one.
    case 'empty':
      return (
        <View style={styles.frame}>
          <View style={[styles.uldBox, { borderColor: color }]} />
          <View style={[styles.slopeMask, { backgroundColor: background }]} />
          <View style={[styles.slopeEdge, { backgroundColor: color }]} />
        </View>
      );

    // Cargo dropping into an open ULD at the baggage hall.
    case 'packing':
      return (
        <View style={styles.frame}>
          <View style={[styles.packBox, { borderColor: color }]} />
          <View style={[styles.packItem, { left: 5, backgroundColor: color }]} />
          <View style={[styles.packItem, { right: 5, backgroundColor: color }]} />
        </View>
      );

    case 'in_route':
      return (
        <View style={styles.frame}>
          <TractorIcon color={color} background={background} />
        </View>
      );

    // Filled stacks side by side: ULDs parked in the buffer.
    case 'buffer':
      return (
        <View style={styles.frame}>
          <View style={styles.bufferGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={[styles.bufferCell, { backgroundColor: color }]} />
            ))}
          </View>
        </View>
      );

    case 'delivered':
      return (
        <View style={styles.frame}>
          <Text style={[styles.plane, { color }]}>✈</Text>
        </View>
      );
  }
}

const ICON_W = 32;
const ICON_H = 26;

const styles = StyleSheet.create({
  frame: { width: ICON_W, height: ICON_H, alignItems: 'center', justifyContent: 'center' },
  uldBox: { width: 26, height: 19, borderWidth: 2, borderRadius: 2 },
  // A square rotated onto the top-left corner, filled with the card's own
  // background, cuts the corner away; the bar redraws the edge on the slope.
  slopeMask: { position: 'absolute', left: -4, top: -3, width: 13, height: 13, transform: [{ rotate: '45deg' }] },
  slopeEdge: { position: 'absolute', left: 1, top: 6, width: 12, height: 2, transform: [{ rotate: '-45deg' }] },
  packBox: { width: 22, height: 13, borderWidth: 2, borderRadius: 2, marginTop: 8 },
  packItem: { position: 'absolute', top: 1, width: 5, height: 5, borderRadius: 1 },
  bufferGrid: {
    width: 26,
    height: 19,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    alignContent: 'center',
    justifyContent: 'center',
  },
  bufferCell: { width: 7, height: 7, borderRadius: 1 },
  plane: { fontSize: 21, lineHeight: 25 },
});
