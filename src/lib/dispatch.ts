/**
 * Mock ramp-dispatch data: where a scanned ULD needs to go, by when, and who
 * it gets assigned to. There's no real ramp/ops backend behind this POC, so
 * everything here is generated deterministically from the ULD code -- the
 * same code always produces the same stand/time/priority, which makes the
 * demo feel consistent across repeated scans instead of re-randomizing.
 */

import { colors } from './theme';

export type Priority = 'standard' | 'priority' | 'aog';

export interface DispatchInfo {
  stand: string;
  startTime: number;
  latestDeliveryTime: number;
  priority: Priority;
}

export type DriverStatus = 'available' | 'on_route';

export interface Driver {
  id: string;
  /** Short tug/vehicle code shown as a chip, e.g. "T004". */
  code: string;
  name: string;
  vehicle: string;
  status: DriverStatus;
  shiftStart: string;
  shiftEnd: string;
  /** How many other transportation orders are already queued to this driver. */
  activeTasks: number;
}

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  standard: { label: 'Standard', color: '#374151', bg: '#F3F4F6' },
  priority: { label: 'Priority', color: '#B45309', bg: '#FEF3C7' },
  aog: { label: 'AOG · Critical', color: '#B91C1C', bg: '#FEE2E2' },
};

export const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', code: 'T347', name: 'Marcus Webb', vehicle: 'Tug 04', status: 'available', shiftStart: '05:00', shiftEnd: '14:00', activeTasks: 0 },
  { id: 'd2', code: 'T002', name: 'Priya Nair', vehicle: 'Tug 11', status: 'available', shiftStart: '06:00', shiftEnd: '15:00', activeTasks: 1 },
  { id: 'd3', code: 'T122', name: 'Sam Okafor', vehicle: 'Tug 07', status: 'on_route', shiftStart: '05:00', shiftEnd: '16:00', activeTasks: 2 },
  { id: 'd4', code: 'T075', name: 'Elena Kowalski', vehicle: 'Tug 15', status: 'available', shiftStart: '05:00', shiftEnd: '14:00', activeTasks: 0 },
  { id: 'd5', code: 'T034', name: 'Jonas Berg', vehicle: 'Tug 02', status: 'on_route', shiftStart: '05:00', shiftEnd: '14:00', activeTasks: 3 },
  { id: 'd6', code: 'T091', name: 'Aisha Mensah', vehicle: 'Tug 19', status: 'available', shiftStart: '07:00', shiftEnd: '16:00', activeTasks: 1 },
];

// djb2 string hash -> mulberry32 PRNG, so a given ULD code always maps to
// the same sequence of "random" values.
function seedFromString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAND_PREFIXES = ['A', 'B', 'C', 'D'];

export function generateDispatchInfo(uldCode: string, now: number = Date.now()): DispatchInfo {
  const rand = mulberry32(seedFromString(uldCode));

  const prefix = STAND_PREFIXES[Math.floor(rand() * STAND_PREFIXES.length)];
  const number = 1 + Math.floor(rand() * 32);
  const stand = `Stand ${prefix}${number}`;

  const priorityRoll = rand();
  const priority: Priority = priorityRoll < 0.1 ? 'aog' : priorityRoll < 0.4 ? 'priority' : 'standard';

  const startOffsetMin = 10 + Math.floor(rand() * 80); // handling can begin in 10-90 min
  const windowMin =
    priority === 'aog'
      ? 20 + Math.floor(rand() * 20) // 20-40 min
      : priority === 'priority'
        ? 45 + Math.floor(rand() * 45) // 45-90 min
        : 90 + Math.floor(rand() * 90); // 90-180 min

  const startTime = now + startOffsetMin * 60_000;
  const latestDeliveryTime = startTime + windowMin * 60_000;

  return { stand, startTime, latestDeliveryTime, priority };
}

const TEST_TYPE_CODES = ['AKE', 'PMC', 'ALF', 'DPE'];
const TEST_AIRLINE_CODES = ['LH', 'BA', 'EK', 'DL'];

/**
 * A fully-formed, already-overdue DispatchInfo for exercising the alert UI
 * on demand, without waiting for a real task's deadline to actually pass.
 */
export function generateTestOverdueDispatch(now: number = Date.now()): DispatchInfo {
  const prefix = STAND_PREFIXES[Math.floor(Math.random() * STAND_PREFIXES.length)];
  const number = 1 + Math.floor(Math.random() * 32);
  const priorityRoll = Math.random();
  const priority: Priority = priorityRoll < 0.15 ? 'aog' : priorityRoll < 0.5 ? 'priority' : 'standard';
  const overdueByMin = 5 + Math.floor(Math.random() * 40);

  return {
    stand: `Stand ${prefix}${number}`,
    startTime: now - (overdueByMin + 30) * 60_000,
    latestDeliveryTime: now - overdueByMin * 60_000,
    priority,
  };
}

/** A random-looking ULD code, well-formed enough to pass parseUldToken. */
export function generateTestUldCode(): string {
  const type = TEST_TYPE_CODES[Math.floor(Math.random() * TEST_TYPE_CODES.length)];
  const serial = String(10000 + Math.floor(Math.random() * 89999));
  const airline = TEST_AIRLINE_CODES[Math.floor(Math.random() * TEST_AIRLINE_CODES.length)];
  return `${type}${serial}${airline}`;
}

export function pickRandomDriver(): Driver {
  return MOCK_DRIVERS[Math.floor(Math.random() * MOCK_DRIVERS.length)];
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatRelative(ts: number, from: number = Date.now()): string {
  const diffMin = Math.round((ts - from) / 60_000);
  if (diffMin <= 0) return 'now';
  if (diffMin < 60) return `in ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

export type TaskStatus = 'overdue' | 'at_risk' | 'on_time' | 'resolved';

// Warn a bit before the deadline, not just after it's blown.
const AT_RISK_WINDOW_MS = 15 * 60_000;

export function getTaskStatus(
  record: { dispatch?: DispatchInfo; resolvedAt?: number },
  now: number = Date.now(),
): TaskStatus {
  if (record.resolvedAt) return 'resolved';
  if (!record.dispatch) return 'on_time';
  const remaining = record.dispatch.latestDeliveryTime - now;
  if (remaining < 0) return 'overdue';
  if (remaining <= AT_RISK_WINDOW_MS) return 'at_risk';
  return 'on_time';
}

// Solid, saturated fills (vs. the pastel PRIORITY_META pills) so a task's
// timing status reads as the more urgent signal at a glance.
export const TASK_STATUS_META: Record<Exclude<TaskStatus, 'on_time'>, { label: string; color: string; bg: string }> = {
  overdue: { label: 'OVERDUE', color: '#FFFFFF', bg: colors.danger },
  at_risk: { label: 'AT RISK', color: '#FFFFFF', bg: colors.warning },
  resolved: { label: 'Resolved', color: '#FFFFFF', bg: colors.success },
};

/** e.g. "18m overdue" / "1h 5m overdue". */
export function formatOverdue(latestDeliveryTime: number, now: number = Date.now()): string {
  const diffMin = Math.max(0, Math.round((now - latestDeliveryTime) / 60_000));
  if (diffMin < 60) return `${diffMin}m overdue`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m === 0 ? `${h}h overdue` : `${h}h ${m}m overdue`;
}
