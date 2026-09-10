import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import { KNOWN_AIRLINE_CODES } from '../lib/uld';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldCompany'>;

const COMPANIES = Object.entries(KNOWN_AIRLINE_CODES);

export default function RequestUldCompanyScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Which company is requesting?</Text>
        <View style={styles.list}>
          {COMPANIES.map(([code, name], i) => (
            <Pressable
              key={code}
              style={[styles.row, i === COMPANIES.length - 1 && styles.rowLast]}
              onPress={() => navigation.navigate('RequestUldType', { companyCode: code })}
            >
              <View style={styles.codeChip}>
                <Text style={styles.codeChipText}>{code}</Text>
              </View>
              <Text style={styles.rowText}>{name}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  codeChipText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  rowText: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', flex: 1 },
});
