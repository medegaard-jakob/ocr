import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRIORITY_META, formatClock, formatRelative, generateDispatchInfo } from '../lib/dispatch';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Dispatch'>;

function ClockIcon() {
  return (
    <View style={styles.clockCircle}>
      <View style={styles.clockHandMinute} />
      <View style={styles.clockHandHour} />
    </View>
  );
}

function PickupIcon() {
  return <View style={styles.pickupBox} />;
}

function DestinationIcon() {
  return (
    <View style={styles.destGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.destCell} />
      ))}
    </View>
  );
}

export default function DispatchScreen({ route, navigation }: Props) {
  const { record } = route.params;
  const codes = record.ulds.map((u) => u.uld?.code ?? 'Unrecognized');
  // ULDs travelling together share one stand/time/priority. Seeding off all
  // their codes keeps it deterministic (same ride -> same dispatch) without
  // needing to merge N separately-generated DispatchInfo objects.
  const seed = codes.join('+');

  // Stable per screen-visit: regenerating on every render would make the
  // stand/time jump around while the dispatcher is looking at it.
  const dispatch = useMemo(() => record.dispatch ?? generateDispatchInfo(seed), [seed, record.dispatch]);
  const priorityMeta = PRIORITY_META[dispatch.priority];
  const windowMin = Math.round((dispatch.latestDeliveryTime - dispatch.startTime) / 60_000);
  const totalTimeLabel = windowMin < 60 ? `${windowMin} min` : `${Math.floor(windowMin / 60)}h ${windowMin % 60}m`;
  const uldCountLabel = `${record.ulds.length} ULD${record.ulds.length > 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.heading}>Transportation order created</Text>

        <View style={styles.card}>
          <View style={styles.routeRow}>
            <PickupIcon />
            <Text style={styles.arrow}>→</Text>
            <DestinationIcon />
            <View style={styles.durationChip}>
              <ClockIcon />
              <Text style={styles.durationChipText}>{totalTimeLabel}</Text>
            </View>
          </View>
          <Text style={styles.routeLabel}>
            {codes.join(', ')} <Text style={styles.routeLabelMuted}>to {dispatch.stand}</Text>
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.uldCountBadge}>{uldCountLabel}</Text>
            <View style={[styles.priorityBadge, { backgroundColor: priorityMeta.bg }]}>
              <Text style={[styles.priorityBadgeText, { color: priorityMeta.color }]}>{priorityMeta.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.timesCard}>
          <TimeRow label="Start time" value={formatClock(dispatch.startTime)} sub={formatRelative(dispatch.startTime)} />
          <TimeRow
            label="Latest delivery"
            value={formatClock(dispatch.latestDeliveryTime)}
            sub={formatRelative(dispatch.latestDeliveryTime)}
          />
        </View>

        <View style={styles.totalTimeRow}>
          <ClockIcon />
          <Text style={styles.totalTimeText}>Total time: {totalTimeLabel}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.assignButton}
          onPress={() => navigation.navigate('AssignDriver', { record: { ...record, dispatch } })}
        >
          <Text style={styles.assignButtonText}>{record.driver ? 'Change driver' : 'Assign driver'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TimeRow({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.timeRow}>
      <Text style={styles.timeRowLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={styles.timeRowValue}>{value}</Text>
        <Text style={styles.timeRowSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: 20, gap: 20 },
  heading: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrow: { color: colors.textSecondary, fontSize: 18, fontWeight: '700' },
  pickupBox: {
    width: 30,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  destGrid: {
    width: 32,
    height: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  destCell: { width: 9, height: 10, backgroundColor: colors.accent, borderRadius: 1 },
  durationChip: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  durationChipText: { color: colors.textPrimary, fontSize: 12.5, fontWeight: '600' },
  routeLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  routeLabelMuted: { color: colors.textSecondary, fontWeight: '400' },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  uldCountBadge: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  priorityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  priorityBadgeText: { fontSize: 12.5, fontWeight: '700' },
  timesCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  timeRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  timeRowLabel: { width: 110, fontSize: 13, color: colors.textSecondary },
  timeRowValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  timeRowSub: { fontSize: 13, color: colors.textSecondary },
  totalTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', marginTop: 8 },
  totalTimeText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  clockCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHandMinute: {
    position: 'absolute',
    width: 1.5,
    height: 7,
    backgroundColor: colors.textSecondary,
    top: 3,
    left: '50%',
    marginLeft: -0.75,
  },
  clockHandHour: {
    position: 'absolute',
    width: 5,
    height: 1.5,
    backgroundColor: colors.textSecondary,
    top: '50%',
    marginTop: -0.75,
    left: 9.5,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  assignButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
});
