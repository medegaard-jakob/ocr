import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Driver,
  MOCK_DRIVERS,
  PRIORITY_META,
  formatClock,
  formatRelative,
  generateDispatchInfo,
} from '../lib/dispatch';
import { saveRecord } from '../lib/storage';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dispatch'>;

export default function DispatchScreen({ route, navigation }: Props) {
  const { record } = route.params;
  const code = record.uld?.code ?? 'UNKNOWN';

  // Stable per screen-visit: regenerating on every render would make the
  // stand/time jump around while the dispatcher is looking at it.
  const dispatch = useMemo(() => record.dispatch ?? generateDispatchInfo(code), [code, record.dispatch]);
  const priorityMeta = PRIORITY_META[dispatch.priority];

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(record.driver?.id ?? null);
  const [confirming, setConfirming] = useState(false);

  const selectedDriver = MOCK_DRIVERS.find((d) => d.id === selectedDriverId) ?? null;

  const onConfirm = async () => {
    if (!selectedDriver) return;
    setConfirming(true);
    try {
      await saveRecord({ ...record, dispatch, driver: selectedDriver });
      navigation.navigate('History');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.code}>{code}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: priorityMeta.bg }]}>
            <Text style={[styles.priorityBadgeText, { color: priorityMeta.color }]}>{priorityMeta.label}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Destination</Text>
          <View style={styles.standCard}>
            <Text style={styles.standValue}>{dispatch.stand}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Row label="Start time" value={formatClock(dispatch.startTime)} sub={formatRelative(dispatch.startTime)} />
          <Row
            label="Latest delivery"
            value={formatClock(dispatch.latestDeliveryTime)}
            sub={formatRelative(dispatch.latestDeliveryTime)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Assign driver</Text>
          <FlatList
            data={MOCK_DRIVERS}
            keyExtractor={(d) => d.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <DriverRow driver={item} selected={item.id === selectedDriverId} onPress={() => setSelectedDriverId(item.id)} />
            )}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (!selectedDriver || confirming) && styles.disabledButton]}
          onPress={onConfirm}
          disabled={!selectedDriver || confirming}
        >
          <Text style={styles.primaryButtonText}>
            {confirming ? 'Assigning…' : selectedDriver ? `Assign to ${selectedDriver.name.split(' ')[0]}` : 'Select a driver'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={styles.rowValue}>{value}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function DriverRow({ driver, selected, onPress }: { driver: Driver; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.driverRow, selected && styles.driverRowSelected]} onPress={onPress}>
      <View style={[styles.radio, selected && styles.radioSelected]}>{selected && <View style={styles.radioDot} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.driverName}>{driver.name}</Text>
        <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, driver.status === 'available' ? styles.statusDotFree : styles.statusDotBusy]} />
        <Text style={styles.statusText}>{driver.status === 'available' ? 'Available' : 'On route'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 16, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 24, fontWeight: '700', color: '#111827', letterSpacing: 1 },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  priorityBadgeText: { fontSize: 12, fontWeight: '700' },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  standCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  standValue: { fontSize: 28, fontWeight: '800', color: '#1D4ED8', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { width: 110, fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 13, color: '#6B7280' },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  driverRowSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: '#2563EB' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  driverName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  driverVehicle: { fontSize: 12.5, color: '#6B7280', marginTop: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotFree: { backgroundColor: '#16A34A' },
  statusDotBusy: { backgroundColor: '#D97706' },
  statusText: { fontSize: 12, color: '#6B7280' },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#111827', fontWeight: '700' },
  primaryButton: { flex: 2, paddingVertical: 14, borderRadius: 8, backgroundColor: '#2563EB', alignItems: 'center' },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: 'white', fontWeight: '700' },
});
