import type { UldParseResult } from './lib/uld';

export interface ScanRecord {
  id: string;
  timestamp: number;
  imageUri: string | null;
  rawText: string;
  uld: UldParseResult | null;
  /** True if the user hand-corrected the code on the result screen. */
  manuallyEdited: boolean;
}

export type RootStackParamList = {
  Scanner: undefined;
  Result: { record: ScanRecord };
  History: undefined;
};
