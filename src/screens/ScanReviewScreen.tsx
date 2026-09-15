import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadHistory } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanReview'>;

/**
 * What the continuous scanner caught, before it becomes a task. The scanner
 * deliberately doesn't stop to confirm each read, so this is the one place
 * anything wrong gets dropped -- untick it and it isn't included.
 *
 * Confirming here enters the same downstream the original flow uses, from the
 * dispatch step onward; this screen is a second door into that, not a
 * parallel version of it.
 */
export default function ScanReviewScreen({ navigation, route }: Props) {
  const { entries } = route.params;
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  // Re-checked here rather than carried over from the scanner, so it reflects
  // the tasks as they stand at the moment of committing.
  const [openTaskCodes, setOpenTaskCodes] = useState<Set<string>>(new Set());

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

  const toggle = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const kept = entries.filter((_, i) => !excluded.has(i));

  const onConfirm = () => {
    if (kept.length === 0) return;
    navigation.navigate('TaskRoute', {
      record: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ulds: kept,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.heading}>
        {entries.length} ULD{entries.length === 1 ? '' : 's'} scanned
      </Text>
      <Text style={styles.subheading}>Untick anything that shouldn't be on this task.</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={entries}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => {
          const included = !excluded.has(index);
          const code = item.uld?.code ?? 'Unrecognized';
          const conflict = item.uld ? openTaskCodes.has(item.uld.code) : false;
          return (
            <Pressable
              style={[styles.row, !included && styles.rowExcluded]}
              onPress={() => toggle(index)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: included }}
            >
              <View style={[styles.checkbox, included && styles.checkboxChecked]}>
                {included && <View style={styles.checkboxTick} />}
              </View>
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.code, !included && styles.codeExcluded]}>{code}</Text>
                {conflict && (
                  <Text style={styles.conflictText}>Already on another open task</Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.confirmButton, kept.length === 0 && styles.disabled]}
          onPress={onConfirm}
          disabled={kept.length === 0}
        >
          <Text style={styles.confirmButtonText}>
            {kept.length === 0
              ? 'Select at least one ULD'
              : `Continue with ${kept.length} ULD${kept.length === 1 ? '' : 's'}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heading: { fontSize: 19, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, paddingTop: 16 },
  subheading: { fontSize: 14, color: colors.textSecondary, paddingHorizontal: 20, paddingTop: 4 },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowExcluded: { opacity: 0.5 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxTick: {
    width: 13,
    height: 7,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: 'white',
    transform: [{ rotate: '-45deg' }],
    marginTop: -2,
  },
  thumb: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { borderWidth: 1, borderColor: colors.border },
  rowBody: { flex: 1, gap: 3 },
  code: { color: colors.textPrimary, fontSize: 19, fontWeight: '700', letterSpacing: 0.8 },
  codeExcluded: { textDecorationLine: 'line-through', color: colors.textSecondary },
  conflictText: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  confirmButton: { backgroundColor: colors.accentDeep, borderRadius: 10, paddingVertical: 20, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  confirmButtonText: { color: 'white', fontWeight: '700', fontSize: 19 },
});
