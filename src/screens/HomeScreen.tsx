import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface MenuItem {
  label: string;
  onPress?: () => void;
}

export default function HomeScreen({ navigation }: Props) {
  const items: MenuItem[] = [
    { label: 'Make task', onPress: () => navigation.navigate('Scanner') },
    { label: 'Request empty ULD' },
    { label: 'Driver overview', onPress: () => navigation.navigate('History') },
    { label: 'Full Can Store overview' },
    { label: 'Flight overview' },
    { label: 'Via' },
    { label: 'Map' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
