import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTaskStatus } from '../lib/dispatch';
import { loadHistory } from '../lib/storage';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface MenuItem {
  label: string;
  onPress?: () => void;
}

export default function HomeScreen({ navigation }: Props) {
  const [overdueCount, setOverdueCount] = useState(0);

  // Poll while this screen is focused so the alert appears/updates without
  // needing to leave and come back -- a supervisor may just sit here.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = () => {
        loadHistory().then((records) => {
          if (!active) return;
          const now = Date.now();
          setOverdueCount(records.filter((r) => getTaskStatus(r, now) === 'overdue').length);
        });
      };
      refresh();
      const interval = setInterval(refresh, 30_000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, []),
  );

  const items: MenuItem[] = [
    { label: 'Make task', onPress: () => navigation.navigate('Scanner') },
    { label: 'Request empty ULD' },
    { label: 'Tasks', onPress: () => navigation.navigate('History') },
    { label: 'Full Can Store overview' },
    { label: 'Flight overview' },
    { label: 'Via' },
    { label: 'Map' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {overdueCount > 0 && (
        <Pressable style={styles.alertBanner} onPress={() => navigation.navigate('History')}>
          <Text style={styles.alertBannerText}>
            ⚠ {overdueCount} task{overdueCount > 1 ? 's' : ''} overdue — tap to view
          </Text>
        </Pressable>
      )}
      <View style={styles.spacer} />
      <View style={styles.menu}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            style={[styles.row, i === items.length - 1 && styles.rowLast]}
            onPress={item.onPress}
            disabled={!item.onPress}
          >
            <Text style={[styles.rowText, !item.onPress && styles.rowTextDisabled]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  alertBanner: {
    backgroundColor: colors.danger,
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  alertBannerText: { color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  spacer: { height: 140 },
  menu: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
  },
  row: {
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { color: colors.textPrimary, fontSize: 23, fontWeight: '700' },
  rowTextDisabled: { color: colors.textMuted },
});
