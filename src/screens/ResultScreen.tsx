import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import UldBadge from '../components/UldBadge';
import { KNOWN_AIRLINE_CODES, KNOWN_TYPE_CODES, isValidUldCode, parseUldToken } from '../lib/uld';
import { saveRecord } from '../lib/storage';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;

export default function ResultScreen({ route, navigation }: Props) {
  const { record } = route.params;
  const [code, setCode] = useState(record.uld?.code ?? '');
  const [saving, setSaving] = useState(false);

  const editedUld = code ? parseUldToken(code) : null;
  const codeIsValid = isValidUldCode(code);
  const wasEdited = code !== (record.uld?.code ?? '');

  const typeDescription = editedUld ? KNOWN_TYPE_CODES[editedUld.typeCode] : undefined;
  const airlineDescription = editedUld ? KNOWN_AIRLINE_CODES[editedUld.airlineCode] : undefined;

  const onSave = async () => {
    if (!codeIsValid) {
      Alert.alert('Invalid code', 'Fix the ULD code before saving (3 letters + 4-5 digits + 2-3 letters).');
      return;
    }
    setSaving(true);
    try {
      await saveRecord({
        ...record,
        uld: editedUld ?? record.uld,
        manuallyEdited: wasEdited,
      });
      navigation.navigate('History');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {record.imageUri && <Image source={{ uri: record.imageUri }} style={styles.image} />}

        <View style={styles.section}>
          <Text style={styles.label}>Detected code</Text>
          {record.uld ? (
            <UldBadge uld={record.uld} />
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
            <Text style={styles.rawText}>{record.rawText || '(empty)'}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryButtonText}>Rescan</Text>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, (!codeIsValid || saving) && styles.disabledButton]}
          onPress={onSave}
          disabled={!codeIsValid || saving}
        >
          <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save to history'}</Text>
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
  container: { flex: 1, backgroundColor: 'white' },
  content: { padding: 16, gap: 20 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#E5E7EB' },
  section: { gap: 8 },
  label: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  noMatch: { color: '#B91C1C', fontSize: 14 },
  codeInput: {
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#111827',
  },
  codeInputInvalid: { borderColor: '#DC2626' },
  errorText: { color: '#DC2626', fontSize: 12 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowLabel: { width: 110, fontSize: 13, color: '#6B7280' },
  rowValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  rawBox: { backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 },
  rawText: { fontFamily: 'monospace', fontSize: 13, color: '#374151' },
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
