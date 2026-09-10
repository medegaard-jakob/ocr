import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import BottomBar from '../components/BottomBar';
import { showAlert } from '../lib/alert';
import {
  PRIORITY_META,
  TASK_STATUS_META,
  formatOverdue,
  generateTestOverdueDispatch,
  generateTestUldCode,
  getTaskStatus,
  pickRandomDriver,
  type TaskStatus,
} from '../lib/dispatch';
import { clearHistory, deleteRecord, loadHistory, saveRecord } from '../lib/storage';
import { colors } from '../lib/theme';
import { parseUldToken } from '../lib/uld';
import type { RootStackParamList, ScanRecord } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const STATUS_RANK: Record<TaskStatus, number> = { overdue: 0, at_risk: 1, on_time: 2, resolved: 3 };

// Most urgent first: overdue, then at-risk, then on-time by soonest deadline;
// resolved tasks sink to the bottom, most recently resolved first.
function compareTasks(a: ScanRecord, b: ScanRecord, now: number): number {
  const sa = getTaskStatus(a, now);
  const sb = getTaskStatus(b, now);
  if (sa !== sb) return STATUS_RANK[sa] - STATUS_RANK[sb];
  if (sa === 'resolved') return (b.resolvedAt ?? 0) - (a.resolvedAt ?? 0);
  const da = a.dispatch?.latestDeliveryTime ?? a.timestamp;
  const db = b.dispatch?.latestDeliveryTime ?? b.timestamp;
  return da - db;
}

// Testing convenience: drops in a fresh, already-overdue mock task so the
// alert UI can be exercised on demand instead of waiting for a real deadline
// to pass. Not part of the real scan/dispatch flow.
function generateTestOverdueTask(): ScanRecord {
  const now = Date.now();
  const code = generateTestUldCode();
  return {
    id: `test-${now}-${Math.floor(Math.random() * 100000)}`,
    timestamp: now,
    ulds: [{ imageUri: null, rawText: code, uld: parseUldToken(code), manuallyEdited: false }],
    dispatch: generateTestOverdueDispatch(now),
    driver: pickRandomDriver(),
  };
}

export default function HistoryScreen({ navigation }: Props) {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [now, setNow] = useState(Date.now());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        loadHistory().then((r) => {
          if (active) setRecords(r);
        });
        setNow(Date.now());
      };
      refresh();
      const interval = setInterval(refresh, 30_000);
      return () => {
        active = false;
        clearInterval(interval);
      };
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

  const onAddTestAlert = async () => {
    setRecords(await saveRecord(generateTestOverdueTask()));
  };

  const sortedRecords = [...records].sort((a, b) => compareTasks(a, b, now));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={sortedRecords}
        keyExtractor={(r) => r.id}
        contentContainerStyle={sortedRecords.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet</Text>}
        renderItem={({ item }) => {
          const primary = item.ulds[0];
          const extraCount = item.ulds.length - 1;
          const anyManuallyEdited = item.ulds.some((u) => u.manuallyEdited);
          const status = getTaskStatus(item, now);
          const statusMeta = status !== 'on_time' ? TASK_STATUS_META[status] : null;
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
                <View style={styles.topLine}>
                  {statusMeta && (
                    <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                        {status === 'overdue' && item.dispatch
                          ? formatOverdue(item.dispatch.latestDeliveryTime, now)
                          : statusMeta.label}
                      </Text>
                    </View>
                  )}
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
                </View>

                {item.dispatch && <Text style={styles.standText}>{item.dispatch.stand}</Text>}

                <Text style={styles.code}>
                  {primary.uld?.code ?? 'Unrecognized'}
                  {extraCount > 0 && <Text style={styles.codeExtra}> +{extraCount} more</Text>}
                </Text>

                <View style={styles.bottomLine}>
                  {item.driver && (
                    <View style={styles.driverChip}>
                      <Text style={styles.driverChipText}>
                        {item.driver.name} · {item.driver.vehicle}
                      </Text>
                    </View>
                  )}
                  {anyManuallyEdited && (
                    <View style={styles.editedBadge}>
                      <Text style={styles.editedBadgeText}>Edited</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
              </View>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          <Pressable style={styles.scanButton} onPress={() => navigation.navigate('Scanner')}>
            <Text style={styles.scanButtonText}>Scan another</Text>
          </Pressable>
          <Pressable style={styles.clearButton} onPress={onClearAll}>
            <Text style={styles.clearButtonText}>Clear all</Text>
          </Pressable>
        </View>
        <Pressable style={styles.testAlertButton} onPress={onAddTestAlert}>
          <Text style={styles.testAlertButtonText}>+ Add test alert</Text>
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
    gap: 14,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  thumb: { width: 76, height: 76, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 12, color: colors.textMuted },
  cardBody: { flex: 1, gap: 5, justifyContent: 'center' },
  topLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  standText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  code: { fontSize: 23, fontWeight: '700', color: colors.textPrimary, letterSpacing: 1 },
  codeExtra: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0 },
  timestamp: { fontSize: 13, color: colors.textSecondary },
  bottomLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  driverChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  driverChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  editedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.disabled,
  },
  editedBadgeText: { color: 'white', fontSize: 13, fontWeight: '600' },
  priorityBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  priorityBadgeText: { fontSize: 13, fontWeight: '700' },
  footer: {
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: 'row', gap: 12 },
  scanButton: { flex: 2, paddingVertical: 18, borderRadius: 10, backgroundColor: colors.accentDeep, alignItems: 'center' },
  scanButtonText: { color: 'white', fontWeight: '700', fontSize: 17 },
  clearButton: { flex: 1, paddingVertical: 18, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  clearButtonText: { color: colors.danger, fontWeight: '700', fontSize: 17 },
  testAlertButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.textSecondary,
    alignItems: 'center',
  },
  testAlertButtonText: { color: colors.textSecondary, fontWeight: '700', fontSize: 15 },
});
