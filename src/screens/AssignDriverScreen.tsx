import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Driver, MOCK_DRIVERS } from '../lib/dispatch';
import { saveRecord } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AssignDriver'>;

// Availability + current workload, per the tug/box legend:
// tractor blue = driver available, grey = not available (on route);
// box grey = no active tasks, box blue with bars = that many active tasks.
function TractorIcon({ available }: { available: boolean }) {
  const tint = available ? colors.accent : colors.disabled;
  return (
    <View style={styles.tractorWrap}>
      <View style={[styles.tractorBody, { backgroundColor: tint }]} />
      <View style={[styles.tractorCab, { backgroundColor: tint }]} />
      <View style={[styles.tractorWheel, { left: 3, backgroundColor: colors.surface, borderColor: tint }]} />
      <View style={[styles.tractorWheel, { right: 3, backgroundColor: colors.surface, borderColor: tint }]} />
    </View>
  );
}

function LoadIcon({ activeTasks }: { activeTasks: number }) {
  const active = activeTasks > 0;
  const bars = Math.min(activeTasks, 3);
  return (
    <View style={[styles.loadBox, { backgroundColor: active ? colors.accent : colors.disabled }]}>
      {active &&
        Array.from({ length: bars }).map((_, i) => <View key={i} style={styles.loadBar} />)}
    </View>
  );
}

export default function AssignDriverScreen({ route, navigation }: Props) {
  const { record } = route.params;
  const [selectedId, setSelectedId] = useState<string | null>(record.driver?.id ?? null);
  const [assigning, setAssigning] = useState(false);
  const [toastDriver, setToastDriver] = useState<Driver | null>(null);

  const selectedDriver = MOCK_DRIVERS.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    if (!toastDriver) return;
    const timer = setTimeout(() => {
      navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] }));
    }, 1600);
    return () => clearTimeout(timer);
  }, [toastDriver, navigation]);

  const onAssign = async () => {
    if (!selectedDriver || !record.dispatch) return;
    setAssigning(true);
    try {
      await saveRecord({ ...record, dispatch: record.dispatch, driver: selectedDriver });
      setToastDriver(selectedDriver);
    } catch (err) {
      Alert.alert(
        'Could not save assignment',
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Text style={styles.heading}>{record.dispatch?.stand ?? 'Stand'} driver team</Text>

      <View style={styles.uldSection}>
        <Text style={styles.uldSectionLabel}>
          {record.ulds.length} ULD{record.ulds.length > 1 ? 's' : ''} in this task
        </Text>
        <View style={styles.uldChipRow}>
          {record.ulds.map((entry, i) => (
            <View key={i} style={styles.uldChip}>
              <Text style={styles.uldChipText}>{entry.uld?.code ?? 'Unrecognized'}</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={MOCK_DRIVERS}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <DriverRow driver={item} selected={item.id === selectedId} onPress={() => setSelectedId(item.id)} />
        )}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.assignButton, (!selectedDriver || assigning) && styles.disabled]}
          onPress={onAssign}
          disabled={!selectedDriver || assigning}
        >
          <Text style={styles.assignButtonText}>
            {assigning ? 'Assigning…' : selectedDriver ? `Assign to ${selectedDriver.name.split(' ')[0]}` : 'Select a driver'}
          </Text>
        </Pressable>
      </View>

      {toastDriver && (
        <View style={styles.toastBackdrop}>
          <View style={styles.toastCard}>
            <View style={styles.toastIconRow}>
              <View style={styles.toastListIcon}>
                <View style={styles.toastListBar} />
                <View style={styles.toastListBar} />
                <View style={styles.toastListBar} />
              </View>
              <Text style={styles.toastArrow}>→</Text>
              <TractorIcon available />
            </View>
            <Text style={styles.toastText}>
              {record.ulds.length > 1 ? 'Tasks' : 'Task'} sent to {toastDriver.vehicle.toLowerCase()}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DriverRow({ driver, selected, onPress }: { driver: Driver; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected && <View style={styles.checkboxTick} />}
      </View>
      <View style={styles.codeChip}>
        <Text style={styles.codeChipText}>{driver.code}</Text>
      </View>
      <TractorIcon available={driver.status === 'available'} />
      <LoadIcon activeTasks={driver.activeTasks} />
      <View style={{ flex: 1 }}>
        <Text style={styles.driverName}>{driver.name}</Text>
        <Text style={styles.driverShift}>
          {driver.shiftStart} - {driver.shiftEnd}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  heading: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, paddingHorizontal: 20, paddingTop: 16 },
  uldSection: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  uldSectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  uldChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uldChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  uldChipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxTick: { width: 9, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: 'white', transform: [{ rotate: '-45deg' }], marginTop: -2 },
  codeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  codeChipText: { color: colors.textPrimary, fontSize: 11.5, fontWeight: '700' },
  tractorWrap: { width: 26, height: 20, alignItems: 'center', justifyContent: 'center' },
  tractorBody: { width: 20, height: 10, borderRadius: 2, position: 'absolute', bottom: 4 },
  tractorCab: { width: 9, height: 8, borderRadius: 2, position: 'absolute', top: 1, right: 2 },
  tractorWheel: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, position: 'absolute', bottom: 0 },
  loadBox: {
    width: 22,
    height: 20,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  loadBar: { width: 12, height: 2, backgroundColor: 'white', borderRadius: 1 },
  driverName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  driverShift: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  assignButton: { backgroundColor: colors.accentDeep, borderRadius: 8, paddingVertical: 16, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  assignButtonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  toastBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(14,37,50,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  toastCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastIconRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toastListIcon: { width: 26, height: 22, justifyContent: 'space-between' },
  toastListBar: { height: 3, borderRadius: 1.5, backgroundColor: colors.accent },
  toastArrow: { color: colors.textSecondary, fontSize: 18, fontWeight: '700' },
  toastText: { color: colors.accent, fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
