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
 * The three ULD-shaped stages are told apart by how full they are, not by
 * subtly different outlines: empty is hollow, being packed is part-filled
 * with a piece dropping in, and unknown isn't a contoured ULD at all -- it's
 * a plain box with a question mark, because the whole point of that count is
 * that nobody knows what state those ULDs are in. At icon size an outline
 * that differs only at one corner is not a difference.
 *
 * Every mark takes its color from the caller so a stage can go green when
 * delivered or orange when at risk, rather than each icon deciding for
 * itself. `background` is whatever surface the icon sits on; the cut corner
 * is masked against it.
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
    // Not a ULD silhouette on purpose -- this count is the ones we can't
    // place, so it shouldn't look like a particular kind of ULD.
    case 'unknown':
      return (
        <View style={styles.frame}>
          <View style={[styles.plainBox, { borderColor: color }]}>
            <Text style={[styles.question, { color }]}>?</Text>
          </View>
        </View>
      );

    case 'empty':
      return (
        <View style={styles.frame}>
          <UldProfile color={color} background={background} />
        </View>
      );

    // Part-filled, with a piece still dropping in.
    case 'packing':
      return (
        <View style={styles.frame}>
          <UldProfile color={color} background={background}>
            <View style={[styles.packFill, { backgroundColor: color }]} />
          </UldProfile>
          <View style={[styles.packItem, { backgroundColor: color }]} />
        </View>
      );

    case 'in_route':
      return (
        <View style={styles.frame}>
          <TractorIcon color={color} background={background} />
        </View>
      );

    // Several ULDs parked side by side.
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

/** The contoured ULD silhouette: a box with the top corner cut away. */
function UldProfile({
  color,
  background,
  children,
}: {
  color: string;
  background: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.profileWrap}>
      <View style={[styles.profileBox, { borderColor: color }]}>{children}</View>
      <View style={[styles.slopeMask, { backgroundColor: background }]} />
      <View style={[styles.slopeEdge, { backgroundColor: color }]} />
    </View>
  );
}

const ICON_W = 32;
const ICON_H = 26;
const STROKE = 2.5;

const styles = StyleSheet.create({
  frame: { width: ICON_W, height: ICON_H, alignItems: 'center', justifyContent: 'center' },

  plainBox: {
    width: 24,
    height: 18,
    borderWidth: STROKE,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: { fontSize: 11, fontWeight: '700', lineHeight: 13 },

  profileWrap: { width: 24, height: 18, marginTop: 3 },
  profileBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderWidth: STROKE,
    borderRadius: 2,
    justifyContent: 'flex-end',
  },
  // A square rotated onto the top-left corner, filled with whatever the icon
  // sits on, cuts the corner away; the bar redraws the edge along the slope.
  slopeMask: { position: 'absolute', left: -7, top: -7, width: 17, height: 17, transform: [{ rotate: '45deg' }] },
  slopeEdge: { position: 'absolute', left: -1, top: 4, width: 14, height: STROKE, transform: [{ rotate: '-45deg' }] },

  packFill: { height: 6, marginHorizontal: 1, marginBottom: 1, borderRadius: 1 },
  packItem: { position: 'absolute', top: 0, right: 6, width: 5, height: 5, borderRadius: 1 },

  bufferGrid: {
    width: 24,
    height: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2.5,
    alignContent: 'center',
    justifyContent: 'center',
  },
  // Slightly lighter than a packed grid of squares would be: color already
  // carries the state, so no stage should out-shout the others by weight.
  bufferCell: { width: 6, height: 6, borderRadius: 1 },

  plane: { fontSize: 21, lineHeight: 25 },
});
