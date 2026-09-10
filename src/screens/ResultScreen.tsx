import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UldBadge from '../components/UldBadge';
import { showAlert } from '../lib/alert';
import { colors } from '../lib/theme';
import { KNOWN_AIRLINE_CODES, KNOWN_TYPE_CODES, isValidUldCode, parseUldToken } from '../lib/uld';
import { MAX_ULDS_PER_RIDE, type RootStackParamList, type UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { entry, ride } = route.params;
  const [code, setCode] = useState(entry.uld?.code ?? '');

  const editedUld = code ? parseUldToken(code) : null;
  const codeIsValid = isValidUldCode(code);
  const wasEdited = code !== (entry.uld?.code ?? '');
  const canAddAnother = ride.length + 1 < MAX_ULDS_PER_RIDE;

  const typeDescription = editedUld ? KNOWN_TYPE_CODES[editedUld.typeCode] : undefined;
  const airlineDescription = editedUld ? KNOWN_AIRLINE_CODES[editedUld.airlineCode] : undefined;

  const confirmedEntry = (): UldEntry => ({
    imageUri: entry.imageUri,
    rawText: entry.rawText,
    uld: editedUld ?? entry.uld,
    manuallyEdited: wasEdited,
  });

  const onAddAnother = () => {
    if (!codeIsValid) {
      showAlert('Invalid code', 'Fix the ULD code before adding it to the ride.');
      return;
    }
    navigation.navigate('Scanner', { ride: [...ride, confirmedEntry()] });
  };

  const onContinue = () => {
    if (!codeIsValid) {
      showAlert('Invalid code', 'Fix the ULD code before continuing (3 letters + 4-5 digits + 2-3 letters).');
      return;
    }
    navigation.navigate('Dispatch', {
      record: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        ulds: [...ride, confirmedEntry()],
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {ride.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.label}>
              Already in this ride ({ride.length}/{MAX_ULDS_PER_RIDE})
            </Text>
            <View style={styles.rideChipRow}>
              {ride.map((r, i) => (
                <View key={i} style={styles.rideChip}>
                  <Text style={styles.rideChipText}>{r.uld?.code ?? 'Unrecognized'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {entry.imageUri && <Image source={{ uri: entry.imageUri }} style={styles.image} />}

        <View style={styles.section}>
          <Text style={styles.label}>Detected code</Text>
          {entry.uld ? (
            <UldBadge uld={entry.uld} />
          ) : (
            <Text style={styles.noMatch}>No ULD-shaped code found in the scanned text</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>ULD ID (editable)</Text>
          <TextInput
            style={[styles.codeInput, !codeIsValid && styles.codeInputInvalid]}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="AKE12345LH"
          />
          {!codeIsValid && code.length > 0 && (
            <Text style={styles.errorText}>Expected: 3 letters + 4-5 digits + 2-3 letters</Text>
          )}
        </View>

        {editedUld && (
          <View style={styles.section}>
            <Row label="Type code" value={editedUld.typeCode} sub={typeDescription} />
            <Row label="Serial number" value={editedUld.serialNumber} />
            <Row label="Airline code" value={editedUld.airlineCode} sub={airlineDescription} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.label}>Raw OCR text</Text>
          <View style={styles.rawBox}>
            <Text style={styles.rawText}>{entry.rawText || '(empty)'}</Text>
          </View>
        </View>
      </ScrollView>

      {canAddAnother && (
        <Pressable
          style={[styles.addButton, !codeIsValid && styles.disabledButton]}
          onPress={onAddAnother}
          disabled={!codeIsValid}
        >
          <Text style={styles.addButtonText}>
            Add another ULD ({ride.length + 1}/{MAX_ULDS_PER_RIDE})
          </Text>
        </Pressable>
      )}

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Rescan</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, !codeIsValid && styles.disabledButton]}
          onPress={onContinue}
          disabled={!codeIsValid}
        >
          <Text style={styles.primaryButtonText}>Continue to dispatch</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowValue}>{value}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 20 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  section: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  noMatch: { color: colors.danger, fontSize: 16 },
  rideChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rideChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rideChipText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  codeInputInvalid: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { width: 120, fontSize: 14, color: colors.textSecondary },
  rowValue: { fontSize: 19, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  rawBox: { backgroundColor: colors.surface, borderRadius: 8, padding: 12, borderWidth: 1, borderColor: colors.border },
  rawText: { fontFamily: 'monospace', fontSize: 14, color: colors.textSecondary },
  addButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  addButtonText: { color: colors.accent, fontWeight: '700', fontSize: 17 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 17 },
  primaryButton: { flex: 2, paddingVertical: 18, borderRadius: 10, backgroundColor: colors.accentDeep, alignItems: 'center' },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: 'white', fontWeight: '700', fontSize: 17 },
});
