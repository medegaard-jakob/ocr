/**
 * Parsing and validation for IATA ULD (Unit Load Device) identifiers.
 *
 * Format: [type code: 3 letters][serial number: 4-5 digits][airline code: 2-3 letters]
 * e.g. "AKE12345LH" -> type AKE, serial 12345, airline LH (Lufthansa)
 *
 * OCR frequently confuses visually similar glyphs (0/O, 1/I/L, 5/S, 8/B, 2/Z).
 * The parser first tries an exact match, then retries with those substitutions
 * applied only where the expected character class (letter vs digit) requires it.
 */

const ULD_REGEX = /^[A-Z]{3}\d{4,5}[A-Z]{2,3}$/;

// OCR misread -> intended letter, used when a "digit" slot must actually be a letter.
const TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '6': 'G',
  '8': 'B',
};

// OCR misread -> intended digit, used when a "letter" slot must actually be a digit.
const TO_DIGIT: Record<string, string> = {
  O: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
};

export type MatchConfidence = 'exact' | 'corrected';

export interface UldParseResult {
  /** The token as it was found in the OCR text, cleaned of whitespace/punctuation. */
  source: string;
  /** The best-effort valid ULD identifier, after OCR-confusion correction. */
  code: string;
  typeCode: string;
  serialNumber: string;
  airlineCode: string;
  confidence: MatchConfidence;
  /** Number of characters that had to be corrected to reach a valid code. */
  correctionCount: number;
}

function fixSegment(segment: string, table: Record<string, string>, expected: RegExp) {
  let corrections = 0;
  let out = '';
  for (const ch of segment) {
    if (expected.test(ch)) {
      out += ch;
    } else if (table[ch]) {
      out += table[ch];
      corrections += 1;
    } else {
      return null;
    }
  }
  return { value: out, corrections };
}

function tryCombination(token: string, typeLen: 3, serialLen: 4 | 5, airlineLen: 2 | 3): UldParseResult | null {
  if (token.length !== typeLen + serialLen + airlineLen) return null;

  const typeRaw = token.slice(0, typeLen);
  const serialRaw = token.slice(typeLen, typeLen + serialLen);
  const airlineRaw = token.slice(typeLen + serialLen);

  const type = fixSegment(typeRaw, TO_LETTER, /[A-Z]/);
  const serial = fixSegment(serialRaw, TO_DIGIT, /[0-9]/);
  const airline = fixSegment(airlineRaw, TO_LETTER, /[A-Z]/);
  if (!type || !serial || !airline) return null;

  const code = type.value + serial.value + airline.value;
  const correctionCount = type.corrections + serial.corrections + airline.corrections;

  return {
    source: token,
    code,
    typeCode: type.value,
    serialNumber: serial.value,
    airlineCode: airline.value,
    confidence: correctionCount === 0 ? 'exact' : 'corrected',
    correctionCount,
  };
}

/** Attempts to interpret a single cleaned alphanumeric token as a ULD identifier. */
export function parseUldToken(token: string): UldParseResult | null {
  const clean = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length < 9 || clean.length > 11) return null;

  const candidates: UldParseResult[] = [];
  if (clean.length === 9) {
    const r = tryCombination(clean, 3, 4, 2);
    if (r) candidates.push(r);
  } else if (clean.length === 11) {
    const r = tryCombination(clean, 3, 5, 3);
    if (r) candidates.push(r);
  } else if (clean.length === 10) {
    // Ambiguous: could be a 4-digit serial with a 3-letter airline code, or a
    // 5-digit serial with a 2-letter airline code. Try both, prefer fewer corrections.
    const a = tryCombination(clean, 3, 4, 3);
    const b = tryCombination(clean, 3, 5, 2);
    if (a) candidates.push(a);
    if (b) candidates.push(b);
  }

  if (candidates.length === 0) return null;
  candidates.sort((x, y) => x.correctionCount - y.correctionCount);
  return candidates[0];
}

/**
 * Scans raw OCR text (which may contain multiple lines/words) for the best
 * candidate ULD identifier. Checks whole lines first (most common case where
 * the ULD label is printed as one contiguous code), then falls back to
 * individual whitespace-separated words.
 */
export function findUldInText(text: string): UldParseResult | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const tokens = [...lines, ...lines.flatMap((l) => l.split(/\s+/))];

  let best: UldParseResult | null = null;
  for (const token of tokens) {
    const result = parseUldToken(token);
    if (!result) continue;
    if (!best || result.correctionCount < best.correctionCount) {
      best = result;
    }
    if (best.confidence === 'exact') break;
  }
  return best;
}

/** Strict validation of an already-clean ULD code (e.g. after manual entry). */
export function isValidUldCode(code: string): boolean {
  return ULD_REGEX.test(code.toUpperCase());
}

// A handful of common type-code prefixes, for a friendlier result screen.
// Indicative only -- not exhaustive; see the IATA ULD Technical Manual for the full list.
export const KNOWN_TYPE_CODES: Record<string, string> = {
  AKE: 'LD3 container',
  AKH: 'LD3 container (half height)',
  AKN: 'LD3 container (open front)',
  ALF: 'LD26 container',
  AAP: 'Certified pallet with net (full pallet)',
  AAX: 'Certified pallet with net',
  APE: 'LD9 container',
  DPE: 'LD1 igloo container',
  DQF: 'LD3 igloo container',
  PMC: 'Main deck pallet, 96x125in',
  PAG: 'Pallet, 88x125in',
  PLA: 'Pallet, 88x108in',
  PAJ: 'Pallet, 60x125in',
};

// A handful of common IATA airline codes, for a friendlier result screen.
export const KNOWN_AIRLINE_CODES: Record<string, string> = {
  LH: 'Lufthansa',
  BA: 'British Airways',
  AA: 'American Airlines',
  DL: 'Delta Air Lines',
  UA: 'United Airlines',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  SQ: 'Singapore Airlines',
  CX: 'Cathay Pacific',
  KL: 'KLM',
  AF: 'Air France',
  TK: 'Turkish Airlines',
  EY: 'Etihad Airways',
  QF: 'Qantas',
  SAS: 'Scandinavian Airlines',
  VS: 'Virgin Atlantic',
};
