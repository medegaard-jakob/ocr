# ULD Scanner (POC)

A small proof-of-concept mobile app (Expo / React Native) that scans **ULD ID
placards** (the labels on air cargo Unit Load Devices, e.g. `AKE12345LH`)
using the phone camera and on-device OCR, validates the code against the
IATA ULD ID format, and keeps a local scan history.

## What it does

1. **Scanner** — live camera view with a framing guide. Capture a photo of a
   ULD placard.
2. **OCR** — the photo is run through on-device text recognition
   ([Google ML Kit](https://developers.google.com/ml-kit/vision/text-recognition)
   via `@react-native-ml-kit/text-recognition`, fully offline, no network
   call).
3. **Parse & validate** (`src/lib/uld.ts`) — the recognized text is scanned
   for a token matching the ULD ID shape:
   `[3-letter type code][4-5 digit serial][2-3 letter airline code]`
   (e.g. `AKE12345LH`). If the raw OCR text doesn't match exactly, the parser
   retries with common OCR-confusion fixes applied only where the position
   requires a letter vs. a digit (`0↔O`, `1↔I`, `5↔S`, `8↔B`, `2↔Z`, `6↔G`),
   and reports whether the result was an *exact* or *corrected* match.
4. **Result screen** — shows the parsed type/serial/airline breakdown (with
   friendly names for a handful of common type and airline codes), the raw
   OCR text, and lets you hand-correct the code before saving.
5. **History** — saved scans persist locally via `AsyncStorage`.

There's also an **"Enter manually"** path on the scanner screen so the rest
of the app (parsing, result screen, history) can be exercised without a
camera/OCR-capable build — useful in Expo Go or a simulator.

## ULD ID format primer

IATA ULD identifiers follow `TTT NNNNN AA`:
- `TTT` — type code (1st letter = category, e.g. `A` = certified container).
- `NNNNN` — 4 or 5 digit serial number.
- `AA`/`AAA` — 2 or 3 letter airline (owner) code.

See `KNOWN_TYPE_CODES` / `KNOWN_AIRLINE_CODES` in `src/lib/uld.ts` for the
small reference table included in this POC (indicative only — not
exhaustive; consult the IATA ULD Technical Manual for the authoritative
list).

## Running it

```bash
npm install
npx expo start
```

- **Manual-entry flow only** (no native build needed): scan the QR code with
  **Expo Go**, or run `npm run web` / `npm run ios` / `npm run android` in a
  simulator. The camera preview and "Enter manually" path work here.
- **Full OCR flow**: `@react-native-ml-kit/text-recognition` is a native
  module and is **not available in Expo Go**. To test real camera scanning:

  ```bash
  npx expo prebuild
  npx expo run:android   # or: npx expo run:ios (requires macOS/Xcode)
  ```

  This generates native `android`/`ios` projects (gitignored) and builds a
  dev client with the OCR module linked. If the module isn't linked (e.g.
  still running in Expo Go), the app shows an explanatory alert instead of
  crashing, and manual entry keeps working.

## Installing it on a phone without Android Studio/Xcode

If you just want a real installable app on your phone to demo — camera and
OCR both working — without setting up native build tooling, use
[EAS Build](https://docs.expo.dev/build/introduction/) to compile it in the
cloud. Requires a free Expo account (browser signup only) and Node on
whatever machine you run these from — not the phone itself:

```bash
npx eas-cli login          # opens a browser to sign in / create an account
npx eas-cli build --profile preview --platform android
```

The first run also asks to link the project to your account (creates it
automatically, no extra steps). The build runs on Expo's servers — takes a
few minutes — and finishes with a QR code and download link. Scan it (or
open the link) on your phone to install the APK directly; no app store, no
computer needed after that. `eas.json` in this repo already defines the
`preview` build profile used above.

(A web browser or the Claude artifact preview can't do this step for you —
camera-stream permissions and Claude's own "ask Claude" capability are both
sandboxed differently there, which is why those routes hit dead ends for a
full working demo. This is the one path with no such caveats.)

## Project layout

```
App.tsx                     navigation root
src/
  types.ts                  ScanRecord + navigation param types
  lib/
    uld.ts                  ULD ID parsing, validation, OCR-confusion correction
    storage.ts               AsyncStorage-backed scan history
  components/
    ScanFrameOverlay.tsx     camera viewfinder guide
    UldBadge.tsx             exact/corrected match badge
  screens/
    ScannerScreen.tsx        camera capture + manual entry
    ResultScreen.tsx         parsed breakdown, correction, save
    HistoryScreen.tsx        saved scans list
  navigation/
    RootNavigator.tsx        native-stack navigator
```

## Notes / next steps for a real product

- The type/airline reference tables are tiny samples; a production build
  would ship (or fetch) the full IATA code lists.
- No backend — this is local-only. A real deployment would sync scans to a
  cargo/baggage handling system.
- No barcode/QR fallback — many real ULD placards also carry a barcode,
  which would be a faster and more reliable scan path than pure OCR.
- Consider live/streaming OCR (frame-by-frame) instead of "capture then
  process" for faster scans once the POC's core validation logic is proven.
