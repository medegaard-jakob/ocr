import type { DispatchInfo, Driver } from './lib/dispatch';
import type { UldParseResult } from './lib/uld';

/** One scanned or manually-entered ULD, confirmed on the Result screen. */
export interface UldEntry {
  imageUri: string | null;
  rawText: string;
  uld: UldParseResult | null;
  /** True if the user hand-corrected the code on the result screen. */
  manuallyEdited: boolean;
}

export const MAX_ULDS_PER_RIDE = 4;

/** A ride: 1-4 ULDs travelling together to one destination on one driver. */
export interface ScanRecord {
  id: string;
  timestamp: number;
  ulds: UldEntry[];
  /** Where/when this ride needs to go. Set once the scan reaches the dispatch step. */
  dispatch?: DispatchInfo;
  /** Driver assigned to move it. Set once dispatch is confirmed. */
  driver?: Driver;
  /** Set once the supervisor marks this task resolved; stops it counting as overdue. */
  resolvedAt?: number;
  /** Set when the supervisor sends a mock nudge to the assigned driver. */
  lastNudgedAt?: number;
}

export type RootStackParamList = {
  Home: undefined;
  /** `ride` holds ULDs already confirmed for this ride when scanning the next one. */
  Scanner: { ride?: UldEntry[] } | undefined;
  /** `entry` is the just-captured ULD awaiting confirmation; `ride` is what's already confirmed. */
  Result: { entry: UldEntry; ride: UldEntry[] };
  Dispatch: { record: ScanRecord };
  AssignDriver: { record: ScanRecord };
  History: undefined;
};
