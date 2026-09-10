import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BottomBar from '../components/BottomBar';
import UldBadge from '../components/UldBadge';
import { showAlert } from '../lib/alert';
import { PRIORITY_META } from '../lib/dispatch';
import { clearHistory, deleteRecord, loadHistory } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList, ScanRecord } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

export default function HistoryScreen({ navigation }: Props) {
  const [records, setRecords] = useState<ScanRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory().then(setRecords);
    }, []),
  );

  const onDelete = (id: string) => {
    showAlert('Delete scan?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => setRecords(await deleteRecord(id)),
      },
    ]);
  };

  const onClearAll = () => {
    if (records.length === 0) return;
    showAlert('Clear all history?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setRecords([]);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={records}
        keyExtractor={(r) => r.id}
        contentContainerStyle={records.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No scans saved yet</Text>}
        renderItem={({ item }) => {
          const primary = item.ulds[0];
          const extraCount = item.ulds.length - 1;
          const anyManuallyEdited = item.ulds.some((u) => u.manuallyEdited);
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate('Dispatch', { record: item })}
              onLongPress={() => onDelete(item.id)}
            >
              {primary.imageUri ? (
                <Image source={{ uri: primary.imageUri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]}>
                  <Text style={styles.thumbPlaceholderText}>manual</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.code}>
                  {primary.uld?.code ?? 'Unrecognized'}
                  {extraCount > 0 && <Text style={styles.codeExtra}> +{extraCount} more</Text>}
                </Text>
                <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
                <View style={styles.badgeRow}>
                  {primary.uld && <UldBadge uld={primary.uld} />}
                  {item.dispatch && (
                    <View
                      style={[
                        styles.priorityBadge,
                        { backgroundColor: PRIORITY_META[item.dispatch.priority].bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.priorityBadgeText,
                          { color: PRIORITY_META[item.dispatch.priority].color },
                        ]}
                      >
                        {PRIORITY_META[item.dispatch.priority].label}
                      </Text>
                    </View>
                  )}
                  {anyManuallyEdited && (
                    <View style={styles.editedBadge}>
                      <Text style={styles.editedBadgeText}>Manually edited</Text>
                    </View>
                  )}
                </View>
                {item.dispatch && (
                  <Text style={styles.dispatchLine}>
                    {item.dispatch.stand}
                    {item.driver ? ` · ${item.driver.name} (${item.driver.vehicle})` : ' · unassigned'}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <Pressable style={styles.scanButton} onPress={() => navigation.navigate('Scanner')}>
          <Text style={styles.scanButtonText}>Scan another</Text>
        </Pressable>
        <Pressable style={styles.clearButton} onPress={onClearAll}>
          <Text style={styles.clearButtonText}>Clear all</Text>
        </Pressable>
      </View>
      <BottomBar onBack={() => navigation.navigate('Home')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 11, color: colors.textMuted },
  cardBody: { flex: 1, gap: 4, justifyContent: 'center' },
  code: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  codeExtra: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0 },
  timestamp: { fontSize: 12, color: colors.textSecondary },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.disabled,
  },
  editedBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700' },
  dispatchLine: { fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scanButton: { flex: 2, paddingVertical: 14, borderRadius: 8, backgroundColor: colors.accentDeep, alignItems: 'center' },
  scanButtonText: { color: 'white', fontWeight: '700' },
  clearButton: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  clearButtonText: { color: colors.danger, fontWeight: '700' },
});
