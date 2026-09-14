import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomBar from '../components/BottomBar';
import UldStageIcon from '../components/UldStageIcon';
import { formatClock } from '../lib/dispatch';
import {
  Flight,
  STAGE_LABELS,
  ULD_STAGES,
  UldStage,
  flightLabel,
  getMockFlights,
  stageAtRisk,
  stageCount,
} from '../lib/flights';
import { colors } from '../lib/theme';
import { KNOWN_AIRLINE_CODES } from '../lib/uld';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FlightOverview'>;

export default function FlightOverviewScreen({ navigation }: Props) {
  // Flights are anchored to the moment the screen opened and then left alone,
  // while `now` keeps ticking -- so departures genuinely close in and ULDs
  // slip into at-risk while the supervisor is watching, rather than every
  // deadline sliding forward out of reach.
  const [flights] = useState<Flight[]>(() => getMockFlights());
  const [now, setNow] = useState(() => Date.now());

  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      const interval = setInterval(() => setNow(Date.now()), 30_000);
      return () => clearInterval(interval);
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={flights}
        keyExtractor={(f) => f.id}
        contentContainerStyle={flights.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No active flights</Text>}
        renderItem={({ item }) => <FlightCard flight={item} now={now} />}
      />
      <BottomBar onBack={() => navigation.navigate('Home')} />
    </SafeAreaView>
  );
}

function FlightCard({ flight, now }: { flight: Flight; now: number }) {
  const airline = KNOWN_AIRLINE_CODES[flight.airlineCode];

  return (
    <View style={styles.card}>
      <View style={styles.topLine}>
        <Text style={styles.flightId}>{flightLabel(flight)}</Text>
        <View style={styles.carrierChip}>
          <Text style={styles.carrierChipText} numberOfLines={1}>
            {airline ? `${flight.airlineCode} · ${airline}` : flight.airlineCode}
          </Text>
        </View>
      </View>

      <View style={styles.timesRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>MAKE-UP OPEN</Text>
          <Text style={styles.makeUpValue}>{formatClock(flight.makeUpOpen)}</Text>
        </View>
        <View style={styles.timeBlock}>
          <Text style={styles.timeLabel}>ETD</Text>
          <Text style={styles.etdValue}>{formatClock(flight.etd)}</Text>
        </View>
      </View>

      <View style={styles.stageRow}>
        {ULD_STAGES.map((stage) => (
          <StageCell
            key={stage}
            stage={stage}
            count={stageCount(flight, stage)}
            atRisk={stageAtRisk(flight, stage, now)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * One stage's icon and count. Colour carries the meaning: delivered ULDs are
 * green because they're safely on the aircraft, any stage still holding a ULD
 * that won't make the flight goes orange, and a stage with nothing in it
 * recedes -- most flights are empty in most stages, and those zeroes
 * shouldn't compete with the numbers that matter.
 */
function StageCell({ stage, count, atRisk }: { stage: UldStage; count: number; atRisk: boolean }) {
  const color =
    count === 0
      ? colors.textMuted
      : atRisk
        ? colors.warning
        : stage === 'delivered'
          ? colors.success
          : colors.textPrimary;

  return (
    <View
      style={styles.stageCell}
      accessible
      accessibilityLabel={`${STAGE_LABELS[stage]}: ${count}${atRisk ? ', at risk' : ''}`}
    >
      <UldStageIcon stage={stage} color={color} />
      <Text style={[styles.stageCount, { color }]}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 15 },
  card: {
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  topLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flightId: { flexShrink: 0, fontSize: 20, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.5 },
  carrierChip: {
    flexShrink: 1,
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  carrierChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  timesRow: { flexDirection: 'row', gap: 28 },
  timeBlock: { gap: 2 },
  timeLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
  makeUpValue: { fontSize: 17, fontWeight: '600', color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  etdValue: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  stageCell: { alignItems: 'center', gap: 5, minWidth: 36 },
  stageCount: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
