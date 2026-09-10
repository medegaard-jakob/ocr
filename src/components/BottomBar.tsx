import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

/** Slim chrome bar with a back chevron, matching the reference design's bottom nav strip. */
export default function BottomBar({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.backButton} onPress={onBack} hitSlop={12}>
        <Text style={styles.chevron}>‹</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 64,
    backgroundColor: colors.accentDeep,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backButton: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 10 },
  chevron: { color: 'white', fontSize: 32, fontWeight: '300', lineHeight: 32 },
});
