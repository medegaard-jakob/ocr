import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanRecord, UldEntry } from '../types';

const HISTORY_KEY = 'uld-scan-history/v1';

// Records saved before rides could hold multiple ULDs used a flat shape
// (imageUri/rawText/uld/manuallyEdited directly on the record) instead of
// today's `ulds: UldEntry[]`. Without this, an old record loads with no
// `ulds` field at all and crashes the History screen the moment it tries
// to read `item.ulds[0]`. Normalize on the way out of storage so old scans
// keep working instead of taking the whole list down.
function migrateRecord(raw: unknown): ScanRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.timestamp !== 'number') return null;

  // The "mark delivered" field was renamed to resolvedAt. Without this, a
  // task marked done before that rename has no resolvedAt the app
  // recognizes, so it silently falls back to overdue again.
  const { deliveredAt, ...rest } = r;
  const resolvedAt =
    typeof rest.resolvedAt === 'number' ? rest.resolvedAt : typeof deliveredAt === 'number' ? deliveredAt : undefined;

  if (Array.isArray(rest.ulds)) {
    return { ...(rest as unknown as ScanRecord), resolvedAt };
  }

  // Legacy single-ULD shape.
  const entry: UldEntry = {
    imageUri: typeof rest.imageUri === 'string' ? rest.imageUri : null,
    rawText: typeof rest.rawText === 'string' ? rest.rawText : '',
    uld: (rest.uld as UldEntry['uld']) ?? null,
    manuallyEdited: rest.manuallyEdited === true,
  };
  return {
    id: r.id,
    timestamp: r.timestamp,
    ulds: [entry],
    dispatch: rest.dispatch as ScanRecord['dispatch'],
    driver: rest.driver as ScanRecord['driver'],
    resolvedAt,
  };
}

export async function loadHistory(): Promise<ScanRecord[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown[];
    const migrated = parsed.map(migrateRecord).filter((r): r is ScanRecord => r !== null);
    return migrated.sort((a, b) => b.timestamp - a.timestamp);
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
