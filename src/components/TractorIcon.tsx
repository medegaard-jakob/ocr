import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

/**
 * The tug/tractor mark, hand-built from Views like the rest of the app's
 * icons. Shared so the driver picker (where the tint means available vs. on
 * route) and the flight card's "in route" count draw the same vehicle.
 *
 * `background` fills the wheels so they read as hollow -- pass whatever the
 * icon is sitting on, since rows and cards use different surfaces.
 */
export default function TractorIcon({
  color,
  background = colors.surface,
}: {
  color: string;
  background?: string;
}) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.body, { backgroundColor: color }]} />
      <View style={[styles.cab, { backgroundColor: color }]} />
      <View style={[styles.wheel, { left: 3, backgroundColor: background, borderColor: color }]} />
      <View style={[styles.wheel, { right: 3, backgroundColor: background, borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 32, height: 25, alignItems: 'center', justifyContent: 'center' },
  body: { width: 25, height: 12, borderRadius: 2, position: 'absolute', bottom: 5 },
  cab: { width: 11, height: 10, borderRadius: 2, position: 'absolute', top: 1, right: 2 },
  wheel: { width: 7, height: 7, borderRadius: 4, borderWidth: 2, position: 'absolute', bottom: 0 },
});
