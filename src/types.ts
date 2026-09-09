import type { DispatchInfo, Driver } from './lib/dispatch';
import type { UldParseResult } from './lib/uld';

export interface ScanRecord {
  id: string;
  timestamp: number;
  imageUri: string | null;
  rawText: string;
  uld: UldParseResult | null;
  /** True if the user hand-corrected the code on the result screen. */
  manuallyEdited: boolean;
  /** Where/when this ULD needs to go. Set once the scan reaches the dispatch step. */
  dispatch?: DispatchInfo;
  /** Driver assigned to move it. Set once dispatch is confirmed. */
  driver?: Driver;
}

export type RootStackParamList = {
  Home: undefined;
  Scanner: undefined;
  Result: { record: ScanRecord };
  Dispatch: { record: ScanRecord };
  AssignDriver: { record: ScanRecord };
  History: undefined;
};
