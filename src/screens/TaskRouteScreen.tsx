import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateDispatchInfo } from '../lib/dispatch';
import {
  LOCATION_TYPES,
  LOCATION_TYPE_HINTS,
  LOCATION_TYPE_LABELS,
  LocationType,
  MOCK_LOCATION_CONFIG,
  formatLocation,
  placesForType,
} from '../lib/locations';
import { loadRecentPlaces, rememberPlace } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskRoute'>;

/** Even a large airport tops out in the hundreds, so three digits is the lot. */
const MAX_STAND_DIGITS = 3;

/** Which end of the route is being edited, or neither. */
type Editing = 'from' | 'to' | null;

/**
 * Where the task runs from and to, set before the transportation order is
 * made. Both scan flows come through here.
 *
 * It opens already filled in -- the destination as the app has always
 * guessed it, plus an origin guess -- because correcting two values is
 * quicker than supplying them, and a task that was fine by default should
 * cost one tap to confirm.
 *
 * One screen, not a wizard: picking a place swaps the body for the picker
 * and swaps it back, so the two values stay on screen the whole time and
 * there's nothing to page back through.
 */
export default function TaskRouteScreen({ navigation, route }: Props) {
  const { record } = route.params;

  // Generated once, here, rather than on the dispatch screen: this is now the
  // first screen that shows a stand, and generating it twice would show two
  // different ones.
  const dispatch = useMemo(() => {
    const codes = record.ulds.map((u) => u.uld?.code ?? 'Unrecognized');
    return record.dispatch ?? generateDispatchInfo(codes.join('+'));
  }, [record]);

  const [origin, setOrigin] = useState(dispatch.origin ?? '');
  const [destination, setDestination] = useState(dispatch.stand);
  const [editing, setEditing] = useState<Editing>(null);

  // Picker state, reset each time an end is opened.
  const [pickType, setPickType] = useState<LocationType | null>(null);
  const [standLetter, setStandLetter] = useState(MOCK_LOCATION_CONFIG.standLetters[0]);
  const [standDigits, setStandDigits] = useState('');
  const [otherText, setOtherText] = useState('');
  const [recentPlaces, setRecentPlaces] = useState<string[]>([]);

  useEffect(() => {
    loadRecentPlaces().then(setRecentPlaces);
  }, []);

  const openPicker = (end: Exclude<Editing, null>) => {
    setEditing(end);
    setPickType(null);
    setStandLetter(MOCK_LOCATION_CONFIG.standLetters[0]);
    setStandDigits('');
    setOtherText('');
  };

  const commit = (type: LocationType, place: string) => {
    const label = formatLocation(type, place);
    if (editing === 'from') setOrigin(label);
    else setDestination(label);
    if (type === 'other') {
      rememberPlace(place).then(() => loadRecentPlaces().then(setRecentPlaces));
    }
    setEditing(null);
    setPickType(null);
  };

  const onContinue = () => {
    navigation.navigate('Dispatch', {
      record: {
        ...record,
        dispatch: { ...dispatch, origin: origin || undefined, stand: destination },
      },
    });
  };

  if (editing) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <PickerHeader
          end={editing}
          type={pickType}
          onBack={() => (pickType ? setPickType(null) : setEditing(null))}
        />
        {pickType === null ? (
          <TypeList onPick={setPickType} />
        ) : pickType === 'stand' ? (
          <StandPad
            letter={standLetter}
            digits={standDigits}
            onLetter={setStandLetter}
            onDigits={setStandDigits}
            onUse={() => commit('stand', `${standLetter}${standDigits}`)}
          />
        ) : pickType === 'other' ? (
          <OtherEntry
            value={otherText}
            recent={recentPlaces}
            onChange={setOtherText}
            onUse={(place) => commit('other', place)}
          />
        ) : (
          <PlaceList
            places={placesForType(pickType, MOCK_LOCATION_CONFIG) ?? []}
            selected={editing === 'from' ? origin : destination}
            type={pickType}
            onPick={(place) => commit(pickType, place)}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Where does this task run?</Text>
          <Text style={styles.subheading}>
            Set the pickup and delivery point before the transportation order is made.
          </Text>
        </View>

        <View style={styles.uldSection}>
          <Text style={styles.sectionLabel}>
            {record.ulds.length} ULD{record.ulds.length === 1 ? '' : 'S'} IN THIS TASK
          </Text>
          <View style={styles.uldChipRow}>
            {record.ulds.map((entry, i) => (
              <View key={i} style={styles.uldChip}>
                <Text style={styles.uldChipText}>{entry.uld?.code ?? 'Unrecognized'}</Text>
              </View>
            ))}
          </View>
        </View>

        <EndCard label="FROM" value={origin || 'Not set'} onChange={() => openPicker('from')} />
        <View style={styles.arrowRow}>
          <Text style={styles.arrowDown}>↓</Text>
        </View>
        <EndCard label="TO" value={destination} onChange={() => openPicker('to')} />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !destination && styles.disabled]}
          onPress={onContinue}
          disabled={!destination}
        >
          <Text style={styles.primaryButtonText}>Continue to dispatch</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function EndCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: () => void;
}) {
  return (
    <View style={styles.endCard}>
      <View style={styles.endCardBody}>
        <Text style={styles.endCardLabel}>{label}</Text>
        <Text style={styles.endCardValue}>{value}</Text>
      </View>
      <Pressable
        style={styles.changeButton}
        onPress={onChange}
        accessibilityRole="button"
        accessibilityLabel={`Change the ${label.toLowerCase()} point`}
      >
        <Text style={styles.changeButtonText}>Change</Text>
      </Pressable>
    </View>
  );
}

function PickerHeader({
  end,
  type,
  onBack,
}: {
  end: Exclude<Editing, null>;
  type: LocationType | null;
  onBack: () => void;
}) {
  return (
    <Pressable style={styles.pickerHeader} onPress={onBack} accessibilityRole="button">
      <Text style={styles.pickerBack}>‹</Text>
      <Text style={styles.sectionLabel}>
        {end === 'from' ? 'FROM' : 'TO'}
        {type ? ` · ${LOCATION_TYPE_LABELS[type].toUpperCase()}` : ''}
      </Text>
    </Pressable>
  );
}

function TypeList({ onPick }: { onPick: (type: LocationType) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {LOCATION_TYPES.map((type, i) => (
          <Pressable
            key={type}
            style={[styles.row, i === LOCATION_TYPES.length - 1 && styles.rowLast]}
            onPress={() => onPick(type)}
          >
            <Text style={styles.rowText}>{LOCATION_TYPE_LABELS[type]}</Text>
            <Text style={styles.rowHint}>{LOCATION_TYPE_HINTS[type]}</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footnote}>
        The same five at both ends, so a task can run storage to stand, stand to stand, or anything
        else that actually happens.
      </Text>
    </ScrollView>
  );
}

function PlaceList({
  places,
  selected,
  type,
  onPick,
}: {
  places: string[];
  selected: string;
  type: LocationType;
  onPick: (place: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.list}>
        {places.map((place, i) => {
          const isSelected = selected === formatLocation(type, place);
          return (
            <Pressable
              key={place}
              style={[styles.row, i === places.length - 1 && styles.rowLast]}
              onPress={() => onPick(place)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                {isSelected && <View style={styles.checkboxTick} />}
              </View>
              <Text style={styles.rowText}>{place}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

/**
 * Stands are typed rather than listed: a large airport has hundreds, and a
 * grid of every one would be a worse version of a keypad.
 */
function StandPad({
  letter,
  digits,
  onLetter,
  onDigits,
  onUse,
}: {
  letter: string;
  digits: string;
  onLetter: (letter: string) => void;
  onDigits: (digits: string) => void;
  onUse: () => void;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.standPreview}>
          <Text style={styles.standPreviewLabel}>Stand </Text>
          <Text style={styles.standPreviewValue}>
            {letter}
            {digits}
          </Text>
        </View>

        <View style={styles.letterRow}>
          {MOCK_LOCATION_CONFIG.standLetters.map((l) => (
            <Pressable
              key={l}
              style={[styles.letterKey, l === letter && styles.letterKeyOn]}
              onPress={() => onLetter(l)}
              accessibilityRole="radio"
              accessibilityState={{ selected: l === letter }}
            >
              <Text style={styles.letterKeyText}>{l}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.padGrid}>
          {keys.map((k) => (
            <Pressable
              key={k}
              style={[styles.padKey, digits.length >= MAX_STAND_DIGITS && styles.disabled]}
              onPress={() => onDigits(digits + k)}
              disabled={digits.length >= MAX_STAND_DIGITS}
            >
              <Text style={styles.padKeyText}>{k}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.padKey} onPress={() => onDigits('')}>
            <Text style={styles.padKeySmall}>Clear</Text>
          </Pressable>
          <Pressable
            style={[styles.padKey, digits.length >= MAX_STAND_DIGITS && styles.disabled]}
            onPress={() => onDigits(digits + '0')}
            disabled={digits.length >= MAX_STAND_DIGITS}
          >
            <Text style={styles.padKeyText}>0</Text>
          </Pressable>
          <Pressable style={styles.padKey} onPress={() => onDigits(digits.slice(0, -1))}>
            <Text style={styles.padKeySmall}>Back</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !digits && styles.disabled]}
          onPress={onUse}
          disabled={!digits}
        >
          <Text style={styles.primaryButtonText}>
            {digits ? `Use Stand ${letter}${digits}` : 'Type a stand number'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

/** The one branch that needs a keyboard: anything the named types miss. */
function OtherEntry({
  value,
  recent,
  onChange,
  onUse,
}: {
  value: string;
  recent: string[];
  onChange: (next: string) => void;
  onUse: (place: string) => void;
}) {
  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>NAME THE PLACE</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Maintenance bay 3"
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChange}
          autoFocus
        />
        <Text style={styles.footnote}>
          Anything the five types don't cover — a gate, a maintenance bay, a truck dock.
        </Text>

        {recent.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionLabel}>USED RECENTLY</Text>
            <View style={styles.uldChipRow}>
              {recent.map((place) => (
                <Pressable key={place} style={styles.recentChip} onPress={() => onUse(place)}>
                  <Text style={styles.recentChipText}>{place}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryButton, !value.trim() && styles.disabled]}
          onPress={() => onUse(value.trim())}
          disabled={!value.trim()}
        >
          <Text style={styles.primaryButtonText}>Use this place</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  headingBlock: { gap: 6 },
  heading: { fontSize: 19, fontWeight: '700', color: colors.textPrimary },
  subheading: { fontSize: 14, color: colors.textSecondary },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.6 },
  footnote: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },

  uldSection: { gap: 8 },
  uldChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  uldChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  uldChipText: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', letterSpacing: 0.5 },

  endCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
  },
  endCardBody: { flex: 1, gap: 4 },
  endCardLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.6 },
  endCardValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  changeButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  changeButtonText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  arrowRow: { alignItems: 'center' },
  arrowDown: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },

  pickerHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pickerBack: { color: colors.textSecondary, fontSize: 26, fontWeight: '300', lineHeight: 28 },

  list: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 },
  rowHint: { color: colors.textMuted, fontSize: 14 },
  rowChevron: { color: colors.textMuted, fontSize: 22, fontWeight: '300' },

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

  standPreview: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingVertical: 18,
  },
  standPreviewLabel: { color: colors.textSecondary, fontSize: 20, fontWeight: '600' },
  standPreviewValue: { color: colors.textPrimary, fontSize: 28, fontWeight: '700', letterSpacing: 1 },
  letterRow: { flexDirection: 'row', gap: 8 },
  letterKey: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterKeyOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  letterKeyText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  padGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  padKey: {
    // Basis small enough that three fit a row once gaps are counted, then
    // grown to share the row evenly. A percentage width alone overflowed and
    // dropped the pad to two columns.
    flexBasis: '28%',
    flexGrow: 1,
    height: 62,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: { color: colors.textPrimary, fontSize: 26, fontWeight: '600' },
  padKeySmall: { color: colors.textSecondary, fontSize: 15, fontWeight: '700' },

  textInput: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  recentSection: { gap: 10, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 },
  recentChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recentChipText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  primaryButton: {
    backgroundColor: colors.accentDeep,
    borderRadius: 10,
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 19 },
  disabled: { opacity: 0.5 },
});
