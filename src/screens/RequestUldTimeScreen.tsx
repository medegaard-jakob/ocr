import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatClock, type Priority } from '../lib/dispatch';
import { colors } from '../lib/theme';
import type { RootStackParamList, ScanRecord, UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldTime'>;

type TimingChoice = 'asap' | 'set_time';

// Mirrors the urgency windows generateDispatchInfo already uses for scanned
// tasks (aog: 20-40min, priority: 45-90min, standard: 90-180min), so a
// request's priority badge reflects how tight the deadline actually is
// rather than being picked at random.
function priorityForWindowMin(windowMin: number): Priority {
  if (windowMin <= 40) return 'aog';
  if (windowMin <= 90) return 'priority';
  return 'standard';
}

function defaultTime(): { hour: number; minute: number } {
  const d = new Date(Date.now() + 60 * 60_000);
  let minute = Math.round(d.getMinutes() / 15) * 15;
  let hour = d.getHours();
  if (minute === 60) {
    minute = 0;
    hour = (hour + 1) % 24;
  }
  return { hour, minute };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export default function RequestUldTimeScreen({ route, navigation }: Props) {
  const { typeCode, amount, bank } = route.params;
  const [choice, setChoice] = useState<TimingChoice>('asap');
  const [{ hour, minute }, setTime] = useState(defaultTime);

  const previewDate = new Date();
  previewDate.setHours(hour, minute, 0, 0);

  const changeHour = (delta: number) => setTime((t) => ({ ...t, hour: ((t.hour + delta) % 24 + 24) % 24 }));
  const changeMinute = (delta: number) => setTime((t) => ({ ...t, minute: ((t.minute + delta) % 60 + 60) % 60 }));

  const onConfirm = () => {
    const now = Date.now();
    const startTime = now;
    let latestDeliveryTime: number;

    if (choice === 'asap') {
      latestDeliveryTime = now + 30 * 60_000;
    } else {
      const target = new Date();
      target.setHours(hour, minute, 0, 0);
      if (target.getTime() <= now) target.setDate(target.getDate() + 1);
      latestDeliveryTime = target.getTime();
    }

    const windowMin = Math.round((latestDeliveryTime - startTime) / 60_000);
    const priority = priorityForWindowMin(windowMin);

    const ulds: UldEntry[] = Array.from({ length: amount }, () => ({
      imageUri: null,
      rawText: '',
      uld: null,
      manuallyEdited: false,
    }));

    const record: ScanRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: now,
      ulds,
      dispatch: { stand: bank, startTime, latestDeliveryTime, priority },
      isEmptyRequest: true,
      emptyTypeCode: typeCode,
    };
    navigation.navigate('Dispatch', { record });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>When do you need it?</Text>
        <View style={styles.list}>
          <Pressable
            style={[styles.row, choice === 'asap' && styles.rowSelected]}
            onPress={() => setChoice('asap')}
          >
            <Text style={styles.rowText}>ASAP</Text>
          </Pressable>
          <Pressable
            style={[styles.row, styles.rowLast, choice === 'set_time' && styles.rowSelected]}
            onPress={() => setChoice('set_time')}
          >
            <Text style={styles.rowText}>Set latest delivery time</Text>
          </Pressable>
        </View>

        {choice === 'set_time' && (
          <>
            <View style={styles.timeRow}>
              <View style={styles.stepperGroup}>
                <Text style={styles.stepperLabel}>Hour</Text>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepperButton} onPress={() => changeHour(-1)}>
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{pad(hour)}</Text>
                  <Pressable style={styles.stepperButton} onPress={() => changeHour(1)}>
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.stepperGroup}>
                <Text style={styles.stepperLabel}>Minute</Text>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepperButton} onPress={() => changeMinute(-15)}>
                    <Text style={styles.stepperButtonText}>−</Text>
                  </Pressable>
                  <Text style={styles.stepperValue}>{pad(minute)}</Text>
                  <Pressable style={styles.stepperButton} onPress={() => changeMinute(15)}>
                    <Text style={styles.stepperButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            <Text style={styles.previewText}>Latest delivery: {formatClock(previewDate.getTime())}</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={onConfirm}>
          <Text style={styles.continueButtonText}>Create request</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 20 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  list: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { backgroundColor: colors.accentDeep },
  rowLast: { borderBottomWidth: 0 },
  rowText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  timeRow: { flexDirection: 'row', justifyContent: 'center', gap: 32 },
  stepperGroup: { alignItems: 'center', gap: 10 },
  stepperLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  stepperValue: { color: colors.textPrimary, fontSize: 30, fontWeight: '700', minWidth: 56, textAlign: 'center' },
  previewText: { color: colors.textSecondary, fontSize: 15, textAlign: 'center', fontWeight: '600' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  continueButton: { backgroundColor: colors.accentDeep, borderRadius: 10, paddingVertical: 18, alignItems: 'center' },
  continueButtonText: { color: 'white', fontWeight: '700', fontSize: 18 },
});
