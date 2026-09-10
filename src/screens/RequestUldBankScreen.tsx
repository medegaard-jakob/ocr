import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOCK_BANKS, generateDispatchInfo } from '../lib/dispatch';
import { colors } from '../lib/theme';
import { parseUldToken } from '../lib/uld';
import type { RootStackParamList, ScanRecord, UldEntry } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldBank'>;

// Empty-ULD requests don't have a real scanned serial number, so generate
// well-formed placeholder codes -- this lets the request reuse every
// existing task screen (Dispatch, Assign driver, Tasks list) unchanged.
function generateEmptyUldEntries(typeCode: string, companyCode: string, amount: number): UldEntry[] {
  return Array.from({ length: amount }, () => {
    const serial = String(10000 + Math.floor(Math.random() * 89999));
    const code = `${typeCode}${serial}${companyCode}`;
    return { imageUri: null, rawText: code, uld: parseUldToken(code), manuallyEdited: false };
  });
}

export default function RequestUldBankScreen({ route, navigation }: Props) {
  const { companyCode, typeCode, amount } = route.params;

  const onSelectBank = (bank: string) => {
    const ulds = generateEmptyUldEntries(typeCode, companyCode, amount);
    const seed = ulds.map((u) => u.uld?.code ?? '').join('+');
    const dispatch = { ...generateDispatchInfo(seed), stand: bank };
    const record: ScanRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ulds,
      dispatch,
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
