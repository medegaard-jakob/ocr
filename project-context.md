# Project Context

## 1. What this app does

A mobile/web tool for airport ramp workers who move air cargo containers
("ULDs" — Unit Load Devices) between planes and storage.

- A worker points their phone camera at the ID placard on a ULD (a label
  like `AKE12345LH`) and the app reads it automatically using OCR — no
  manual typing needed.
- The app validates the code, figures out where it needs to go and by when
  (currently simulated, not from a real airport system), and creates a
  "task" for it.
- A supervisor assigns a driver/tug to move it, can "nudge" a driver, and
  gets flagged when a task is running late or overdue.
- Workers can also request **empty** ULDs be delivered to a storage bank
  (no scanning involved — just a form: airline → type/quantity → bank →
  time needed).
- Everything scanned or requested shows up on a **Task overview** screen,
  sorted with the most urgent items first.

In short: a scan-to-dispatch mini task manager for ramp cargo handling,
currently a proof-of-concept (no real backend or live ops data yet).

## 2. Tech stack

- **Language:** TypeScript (strict mode)
- **Framework:** React Native via **Expo** (SDK 57), React 19
- **Web build:** `react-native-web` — same codebase runs as a browser app,
  deployed to GitHub Pages via `.github/workflows/deploy-pages.yml`
- **Navigation:** `@react-navigation/native` + native-stack
- **OCR:**
  - Native (iOS/Android dev build): `@react-native-ml-kit/text-recognition`
    (on-device, offline)
  - Web: `tesseract.js` (WASM, runs entirely in-browser)
- **Camera:** `expo-camera`
- **Storage:** `@react-native-async-storage/async-storage` — **local
  device/browser storage only, no server or database**
- **Haptics:** `expo-haptics` (native only)
- No backend, no API layer, no auth.

## 3. Structure

```
App.tsx                    App entrypoint, wraps navigator
index.ts                   Expo root registration
app.json / eas.json        Expo config + cloud build (EAS) profile

src/
  types.ts                 Core data model (ScanRecord, UldEntry) + nav param types
  lib/
    uld.ts                 ULD code parsing/validation + OCR-typo correction
    dispatch.ts             Mock dispatch data (stand/time/priority), mock drivers,
                            task-status logic (overdue/at-risk/resolved)
    storage.ts              AsyncStorage read/write + legacy-record migration
    alert.ts                Cross-platform confirm/alert dialog wrapper
    theme.ts                Shared colors + spacing constants
  components/
    ScanFrameOverlay.tsx    Camera viewfinder guide overlay
    UldBadge.tsx             "Exact match / Auto-corrected" pill
    BottomBar.tsx            Slim back-nav bar (History screen only)
  screens/
    HomeScreen.tsx           Main menu
    ScannerScreen.tsx        Camera capture, live auto-scan (web), manual entry
    ResultScreen.tsx         Parsed code review/correction, multi-ULD "ride"
    DispatchScreen.tsx       Generated stand/time/priority, status, nudge/resolve
    AssignDriverScreen.tsx   Pick a driver from the mock roster
    HistoryScreen.tsx        "Task overview" — all tasks, sorted by urgency
    RequestUldCompanyScreen.tsx  Empty-ULD request: pick airline
    RequestUldTypeScreen.tsx     ...pick ULD type + quantity
    RequestUldBankScreen.tsx     ...pick delivery bank
    RequestUldTimeScreen.tsx     ...pick ASAP or a specific time
  navigation/
    RootNavigator.tsx        Native-stack screen registry + nav theme

.claude/agents/design-reviewer.md   Playwright-driven UI-consistency reviewer subagent
.github/workflows/deploy-pages.yml  Builds web export, deploys to GitHub Pages
```

## 4. Current features — built vs. stubbed

**Built and working:**
- Camera scan → OCR → parse/validate → correction of common OCR misreads
  (0/O, 1/I, 5/S, 8/B, 2/Z, 6/G)
- Live auto-scan on web (retries ~once/sec, requires two matching reads
  before auto-submitting)
- Manual code entry (fallback when camera/OCR isn't available, e.g. Expo Go)
- Multi-ULD "rides" — up to 4 ULDs bundled into one task
- Dispatch screen: mock stand/time-window/priority (deterministically
  generated from the ULD code, so re-scanning the same code is consistent)
- Task status: on-time / at-risk / overdue / resolved, with a live-updating
  "Xm overdue" label
- Driver assignment from a hardcoded roster of 6, with reassignment flow
- "Nudge driver" and "Mark resolved" actions (local state only, no real
  notification)
- Full "Request empty ULD" flow (airline → type/qty → bank → time → driver)
- Task overview: sorted urgent-first, delete/clear, home-screen overdue banner
  (polls every 30s)
- Local persistence across sessions via AsyncStorage, with migration logic
  for two past data-shape changes

**Visible but not built (dead menu items on Home):**
- Full Can Store overview
- Flight overview
- Via
- Map

These render as greyed-out, non-interactive rows — placeholders for future
scope, not bugs.

## 5. Design/UX patterns so far

- **Theme:** single dark navy palette in `src/lib/theme.ts` (`colors`,
  `spacing`) — background/surface/accent/status colors are consistent, but
  usage isn't fully centralized (see rough edges).
- **Navigation chrome:** native-stack headers are used for most screens
  (with a themed dark header); Home and Scanner hide the header and build
  their own top bar instead.
- **List/picker pattern:** every selection flow (Home menu, airline picker,
  type picker, bank picker, driver list, task list) is a bordered card of
  full-width rows with a bottom divider — the app's dominant UI pattern.
- **Status/priority badges:** small pill components with a fixed color per
  state (`PRIORITY_META`, `TASK_STATUS_META` in `lib/dispatch.ts`) reused
  across Dispatch, AssignDriver, and History screens.
- **Buttons:** a two-tier convention — solid `accentDeep` primary action,
  outlined/`surface` secondary action — repeated per-screen via local
  StyleSheets rather than a shared Button component.
- **Confirmations:** all alerts/confirms go through a custom `showAlert()`
  (not React Native's `Alert` directly), because `react-native-web`'s
  `Alert.alert` is a no-op on web.
- **Transient feedback:** toast/banner pattern for one-off confirmations
  (nudge sent, driver assigned, task resolved) — self-dismisses after ~1.5-2s.
- **Icons:** hand-built from `View` primitives (clock, tractor/tug, load
  bars, destination grid) — no icon library in use.

## 6. Known rough edges

- **No backend at all** — every task, driver, and dispatch time lives only
  in the local browser/device storage. Nothing syncs across devices or users.
- **Dispatch data is fake:** stand/time-window/priority are generated by a
  seeded pseudo-random function keyed off the ULD code (`generateDispatchInfo`
  in `lib/dispatch.ts`) — not from any real ramp/ops system.
- **Driver roster is a hardcoded list of 6** in `lib/dispatch.ts` — no real
  driver accounts, auth, or availability tracking.
- **"Nudge driver" does nothing external** — it's a local timestamp update,
  no actual notification is sent to anyone.
- **Reference tables are tiny samples**, not the full IATA type/airline code
  lists (documented as such in the README).
- **No barcode/QR fallback**, even though most real ULD placards also carry
  a barcode — OCR is the only scan path.
- **Test/demo affordances ship in the real UI:** the "+ Add test alert"
  button on Task overview (and its backing `generateTestOverdueDispatch` /
  `generateTestUldCode` helpers) exist purely to demo the overdue-alert UI
  on demand — not gated behind a dev flag, visible to any user.
- **Web image storage is a workaround, not a fix:** captured photos are
  downscaled to small JPEG data URIs before being written to AsyncStorage's
  web shim (`localStorage`) to avoid blowing its ~5-10MB quota — functional,
  but still fragile at scale (see comments in `ScannerScreen.tsx`).
- **Storage migration logic is already patching two past schema changes**
  (single-ULD record → `ulds[]` array; `deliveredAt` → `resolvedAt`) in
  `storage.ts` — there's no formal versioned-migration system, so this will
  keep growing ad hoc as the data model changes.
- **App identifiers are placeholders:** `com.example.uldscanner` in
  `app.json` — not a real bundle/package ID.
- **No automated tests** anywhere in the repo, and **no linter configured**
  (TypeScript strict mode is the only static check).
- **CI only deploys the web build** — there's no lint/typecheck/test gate
  on pull requests.
- **OCR is native-module-dependent off the web:** `@react-native-ml-kit/text-recognition`
  doesn't work in Expo Go, only in a custom dev-client/release build — the
  app degrades gracefully to "Enter manually" there, but real camera-OCR
  testing on a phone needs `expo prebuild` + a dev-client build (or EAS Build).
