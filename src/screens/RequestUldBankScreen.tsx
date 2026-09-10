import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOCK_BANKS, generateDispatchInfo } from '../lib/dispatch';
import { colors } from '../lib/theme';
import type { RootStackParamList, ScanRecord, UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldBank'>;

// Empty-ULD requests aren't tied to real serial numbers -- nobody requesting
// them knows which specific IDs are in stock, only the type and how many.
// These placeholder entries just carry a count; the type itself is stored on
// the record (isEmptyRequest/emptyTypeCode) so every screen can show "3x AKE"
// instead of a fabricated full code.
function generateEmptyUldEntries(amount: number): UldEntry[] {
  return Array.from({ length: amount }, () => ({
    imageUri: null,
    rawText: '',
    uld: null,
    manuallyEdited: false,
  }));
}

export default function RequestUldBankScreen({ route, navigation }: Props) {
  const { typeCode, amount } = route.params;

  const onSelectBank = (bank: string) => {
    const ulds = generateEmptyUldEntries(amount);
    const seed = `empty-${typeCode}-${amount}-${Date.now()}-${Math.random()}`;
    const dispatch = { ...generateDispatchInfo(seed), stand: bank };
    const record: ScanRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ulds,
      dispatch,
      isEmptyRequest: true,
      emptyTypeCode: typeCode,
    };
    navigation.navigate('Dispatch', { record });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Deliver to which bank?</Text>
        <View style={styles.list}>
          {MOCK_BANKS.map((bank, i) => (
            <Pressable
              key={bank}
              style={[styles.row, i === MOCK_BANKS.length - 1 && styles.rowLast]}
              onPress={() => onSelectBank(bank)}
            >
              <Text style={styles.rowText}>{bank}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16 },
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
  rowLast: { borderBottomWidth: 0 },
  rowText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
});
