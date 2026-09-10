import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MOCK_BANKS } from '../lib/dispatch';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestUldBank'>;

export default function RequestUldBankScreen({ route, navigation }: Props) {
  const { companyCode, typeCode, amount } = route.params;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Deliver to which bank?</Text>
        <View style={styles.list}>
          {MOCK_BANKS.map((bank, i) => (
            <Pressable
              key={bank}
              style={[styles.row, i === MOCK_BANKS.length - 1 && styles.rowLast]}
              onPress={() => navigation.navigate('RequestUldTime', { companyCode, typeCode, amount, bank })}
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
