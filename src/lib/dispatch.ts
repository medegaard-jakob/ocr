/**
 * Mock ramp-dispatch data: where a scanned ULD needs to go, by when, and who
 * it gets assigned to. There's no real ramp/ops backend behind this POC, so
 * everything here is generated deterministically from the ULD code -- the
 * same code always produces the same stand/time/priority, which makes the
 * demo feel consistent across repeated scans instead of re-randomizing.
 */

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
  name: string;
  vehicle: string;
  status: DriverStatus;
}

export const PRIORITY_META: Record<Priority, { label: string; color: string; bg: string }> = {
  standard: { label: 'Standard', color: '#374151', bg: '#F3F4F6' },
  priority: { label: 'Priority', color: '#B45309', bg: '#FEF3C7' },
  aog: { label: 'AOG · Critical', color: '#B91C1C', bg: '#FEE2E2' },
};

export const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'Marcus Webb', vehicle: 'Tug 04', status: 'available' },
  { id: 'd2', name: 'Priya Nair', vehicle: 'Tug 11', status: 'available' },
  { id: 'd3', name: 'Sam Okafor', vehicle: 'Tug 07', status: 'on_route' },
  { id: 'd4', name: 'Elena Kowalski', vehicle: 'Tug 15', status: 'available' },
  { id: 'd5', name: 'Jonas Berg', vehicle: 'Tug 02', status: 'on_route' },
  { id: 'd6', name: 'Aisha Mensah', vehicle: 'Tug 19', status: 'available' },
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
