import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { UldParseResult } from '../lib/uld';

export default function UldBadge({ uld }: { uld: UldParseResult }) {
  const color = uld.confidence === 'exact' ? '#16A34A' : '#D97706';
  const label = uld.confidence === 'exact' ? 'Exact match' : `Auto-corrected (${uld.correctionCount})`;

  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
