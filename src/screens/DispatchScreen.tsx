import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showAlert } from '../lib/alert';
import {
  PRIORITY_META,
  TASK_STATUS_META,
  formatClock,
  formatOverdue,
  formatRelative,
  generateDispatchInfo,
  getTaskStatus,
} from '../lib/dispatch';
import { saveRecord } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList, ScanRecord } from '../types';

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

function nudgedAgo(ts: number, now: number): string {
  const diffMin = Math.max(0, Math.round((now - ts) / 60_000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

export default function DispatchScreen({ route, navigation }: Props) {
  const initialRecord = route.params.record;
  const codes = initialRecord.ulds.map((u) => u.uld?.code ?? 'Unrecognized');
  // ULDs travelling together share one stand/time/priority. Seeding off all
  // their codes keeps it deterministic (same ride -> same dispatch) without
  // needing to merge N separately-generated DispatchInfo objects.
  const seed = codes.join('+');

  const [task, setTask] = useState<ScanRecord>(() => ({
    ...initialRecord,
    dispatch: initialRecord.dispatch ?? generateDispatchInfo(seed),
  }));
  const [nudgeToast, setNudgeToast] = useState(false);

  // Re-render periodically so "overdue by Xm" / at-risk status stays live
  // while the supervisor is looking at this screen.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const dispatch = task.dispatch!;
  const now = Date.now();
  const status = getTaskStatus(task, now);
  const statusMeta = status !== 'on_time' ? TASK_STATUS_META[status] : null;
  const priorityMeta = PRIORITY_META[dispatch.priority];
  const windowMin = Math.round((dispatch.latestDeliveryTime - dispatch.startTime) / 60_000);
  const totalTimeLabel = windowMin < 60 ? `${windowMin} min` : `${Math.floor(windowMin / 60)}h ${windowMin % 60}m`;
  const uldCountLabel = `${task.ulds.length} ULD${task.ulds.length > 1 ? 's' : ''}`;

  const onMarkResolved = async () => {
    const updated = { ...task, resolvedAt: Date.now() };
    setTask(updated);
    try {
      await saveRecord(updated);
    } catch (err) {
      showAlert('Could not save', err instanceof Error ? err.message : String(err));
    }
  };

  const onNudge = async () => {
    const updated = { ...task, lastNudgedAt: Date.now() };
    setTask(updated);
    try {
      await saveRecord(updated);
      setNudgeToast(true);
      setTimeout(() => setNudgeToast(false), 1800);
    } catch (err) {
      showAlert('Could not send nudge', err instanceof Error ? err.message : String(err));
    }
  };

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
            {uldCountLabel} <Text style={styles.routeLabelMuted}>to {dispatch.stand}</Text>
          </Text>

          <View style={styles.uldChipRow}>
            {codes.map((code, i) => (
              <View key={i} style={styles.uldChip}>
                <Text style={styles.uldChipText}>{code}</Text>
              </View>
            ))}
          </View>

          <View style={styles.metaRow}>
            {statusMeta && (
              <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                  {status === 'overdue' ? formatOverdue(dispatch.latestDeliveryTime, now) : statusMeta.label}
                </Text>
              </View>
            )}
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

        {task.driver && (
          <Text style={styles.driverLine}>
            Assigned to {task.driver.name} ({task.driver.vehicle})
            {task.lastNudgedAt ? ` · nudged ${nudgedAgo(task.lastNudgedAt, now)}` : ''}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        {status === 'resolved' ? (
          <View style={styles.resolvedBanner}>
            <Text style={styles.resolvedBannerText}>Resolved at {formatClock(task.resolvedAt!)}</Text>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.assignButton}
              onPress={() => navigation.navigate('AssignDriver', { record: { ...task, dispatch } })}
            >
              <Text style={styles.assignButtonText}>{task.driver ? 'Reassign driver' : 'Assign driver'}</Text>
            </Pressable>

            {task.driver && (
              <View style={styles.secondaryActionsRow}>
                <Pressable style={styles.secondaryActionButton} onPress={onNudge}>
                  <Text style={styles.secondaryActionButtonText}>Nudge driver</Text>
                </Pressable>
                <Pressable style={styles.secondaryActionButton} onPress={onMarkResolved}>
                  <Text style={styles.secondaryActionButtonText}>Mark resolved</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>

      {nudgeToast && (
        <View style={styles.nudgeToast} pointerEvents="none">
          <Text style={styles.nudgeToastText}>Nudge sent to {task.driver?.name}</Text>
        </View>
      )}
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
  heading: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
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
  durationChipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  routeLabel: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', letterSpacing: 0.5 },
  routeLabelMuted: { color: colors.textSecondary, fontWeight: '400' },
  uldChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uldChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  uldChipText: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  statusBadgeText: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  priorityBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  priorityBadgeText: { fontSize: 15, fontWeight: '700' },
  driverLine: { color: colors.textSecondary, fontSize: 14 },
  timesCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
  },
  timeRow: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider },
  timeRowLabel: { width: 120, fontSize: 14, color: colors.textSecondary },
  timeRowValue: { fontSize: 24, fontWeight: '700', color: colors.textPrimary },
  timeRowSub: { fontSize: 14, color: colors.textSecondary },
  totalTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', marginTop: 8 },
  totalTimeText: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
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
    gap: 12,
  },
  assignButton: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  assignButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 18 },
  secondaryActionsRow: { flexDirection: 'row', gap: 12 },
  secondaryActionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryActionButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 16 },
  resolvedBanner: { backgroundColor: colors.success, borderRadius: 10, paddingVertical: 18, alignItems: 'center' },
  resolvedBannerText: { color: 'white', fontWeight: '700', fontSize: 18 },
  nudgeToast: {
    position: 'absolute',
    bottom: 195,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  nudgeToastText: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
});
