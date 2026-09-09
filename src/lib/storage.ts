import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanRecord } from '../types';

const HISTORY_KEY = 'uld-scan-history/v1';

export async function loadHistory(): Promise<ScanRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ScanRecord[];
    return parsed.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function saveRecord(record: ScanRecord): Promise<ScanRecord[]> {
  const existing = await loadHistory();
  const next = [record, ...existing.filter((r) => r.id !== record.id)];
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function deleteRecord(id: string): Promise<ScanRecord[]> {
  const existing = await loadHistory();
  const next = existing.filter((r) => r.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
