import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { KNOWN_TYPE_CODES } from '../lib/uld';
import { MAX_ULDS_PER_RIDE, type RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldType'>;

const TYPES = Object.entries(KNOWN_TYPE_CODES);

export default function RequestUldTypeScreen({ route, navigation }: Props) {
  const { companyCode } = route.params;
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>How many?</Text>
        <View style={styles.stepper}>
          <Pressable
            style={[styles.stepperButton, amount <= 1 && styles.stepperButtonDisabled]}
            onPress={() => setAmount((a) => Math.max(1, a - 1))}
            disabled={amount <= 1}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{amount}</Text>
          <Pressable
            style={[styles.stepperButton, amount >= MAX_ULDS_PER_RIDE && styles.stepperButtonDisabled]}
            onPress={() => setAmount((a) => Math.min(MAX_ULDS_PER_RIDE, a + 1))}
            disabled={amount >= MAX_ULDS_PER_RIDE}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>

        <Text style={styles.heading}>Which ULD type?</Text>
        <View style={styles.list}>
          {TYPES.map(([code, description], i) => {
            const selected = code === typeCode;
            return (
              <Pressable
                key={code}
                style={[styles.row, selected && styles.rowSelected, i === TYPES.length - 1 && styles.rowLast]}
                onPress={() => setTypeCode(code)}
              >
                <View style={[styles.codeChip, selected && styles.codeChipSelected]}>
                  <Text style={[styles.codeChipText, selected && styles.codeChipTextSelected]}>{code}</Text>
                </View>
                <Text style={styles.rowText}>{description}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, !typeCode && styles.disabledButton]}
          onPress={() => typeCode && navigation.navigate('RequestUldBank', { companyCode, typeCode, amount })}
          disabled={!typeCode}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowSelected: { backgroundColor: colors.accentDeep },
  rowLast: { borderBottomWidth: 0 },
  codeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  codeChipSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  codeChipText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  codeChipTextSelected: { color: 'white' },
  rowText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
  },
  stepperButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { opacity: 0.4 },
  stepperButtonText: { color: colors.textPrimary, fontSize: 28, fontWeight: '700' },
  stepperValue: { color: colors.textPrimary, fontSize: 32, fontWeight: '700', minWidth: 48, textAlign: 'center' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  continueButton: { backgroundColor: colors.accentDeep, borderRadius: 10, paddingVertical: 18, alignItems: 'center' },
  disabledButton: { opacity: 0.5 },
  continueButtonText: { color: 'white', fontWeight: '700', fontSize: 18 },
});
