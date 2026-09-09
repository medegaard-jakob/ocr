import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import UldBadge from '../components/UldBadge';
import { clearHistory, deleteRecord, loadHistory } from '../lib/storage';
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
    Alert.alert('Delete scan?', undefined, [
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
    Alert.alert('Clear all history?', undefined, [
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
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate('Result', { record: item })}
            onLongPress={() => onDelete(item.id)}
          >
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Text style={styles.thumbPlaceholderText}>manual</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.code}>{item.uld?.code ?? 'Unrecognized'}</Text>
              <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleString()}</Text>
              <View style={styles.badgeRow}>
                {item.uld && <UldBadge uld={item.uld} />}
                {item.manuallyEdited && (
                  <View style={styles.editedBadge}>
                    <Text style={styles.editedBadgeText}>Manually edited</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
      />
      <View style={styles.footer}>
        <Pressable style={styles.scanButton} onPress={() => navigation.navigate('Scanner')}>
          <Text style={styles.scanButtonText}>Scan another</Text>
        </Pressable>
        <Pressable style={styles.clearButton} onPress={onClearAll}>
          <Text style={styles.clearButtonText}>Clear all</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#9CA3AF', fontSize: 15 },
  card: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#E5E7EB' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { fontSize: 11, color: '#9CA3AF' },
  cardBody: { flex: 1, gap: 4, justifyContent: 'center' },
  code: { fontSize: 17, fontWeight: '700', color: '#111827', letterSpacing: 1 },
  timestamp: { fontSize: 12, color: '#6B7280' },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editedBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#6B7280',
  },
  editedBadgeText: { color: 'white', fontSize: 12, fontWeight: '600' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  scanButton: { flex: 2, paddingVertical: 14, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  scanButtonText: { color: 'white', fontWeight: '700' },
  clearButton: { flex: 1, paddingVertical: 14, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center' },
  clearButtonText: { color: '#B91C1C', fontWeight: '700' },
});
