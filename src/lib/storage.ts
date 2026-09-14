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

  // Assignments used to live only as an embedded Driver snapshot, so a task
  // saved then would render whatever the roster said on the day it was
  // assigned while the driver picker rendered today's roster. Backfill the id
  // off the snapshot so old tasks resolve through the roster like new ones.
  const driver = rest.driver as ScanRecord['driver'];
  const driverId = typeof rest.driverId === 'string' ? rest.driverId : driver?.id;

  if (Array.isArray(rest.ulds)) {
    return { ...(rest as unknown as ScanRecord), driverId, resolvedAt };
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
    driverId,
    driver,
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

// Whether the supervisor has minimized the Flight overview legend. Kept
// because a legend that reopens on every visit isn't really minimizable --
// you learn the icon row once, then want the space back for good.
const LEGEND_COLLAPSED_KEY = 'flight-legend-collapsed/v1';

export async function loadLegendCollapsed(): Promise<boolean> {
  return (await AsyncStorage.getItem(LEGEND_COLLAPSED_KEY)) === 'true';
}

export async function saveLegendCollapsed(collapsed: boolean): Promise<void> {
  await AsyncStorage.setItem(LEGEND_COLLAPSED_KEY, String(collapsed));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
