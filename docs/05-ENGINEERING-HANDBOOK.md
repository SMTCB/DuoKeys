# DuoKeys — Engineering Handbook

**Document ID:** ENG
**Version:** 1.0
**Date:** 2 September 2026
**Purpose:** everything needed between "the architecture is agreed" and "the first
commit", plus the standing conventions that keep the build honest.

---

## 1. Pre-build checklist

Nothing here is optional, and all of it is cheap. This is the list that stops
week-three surprises.

| ID | Activity | Owner | When | Blocking |
|---|---|---|---|---|
| `PRE-001` | Confirm the digital piano's exact model and that it enumerates as a class-compliant USB MIDI device on Windows | You | Before Sprint 0 | Sprint 0 |
| `PRE-002` | Obtain a USB-B→USB-A (or USB-C) cable that is **data-capable**, not charge-only | You | Before Sprint 0 | Sprint 0 |
| `PRE-003` | Verify Chrome or Edge is current and Web MIDI is available (`navigator.requestMIDIAccess` in the console) | You | Before Sprint 0 | Sprint 0 |
| `PRE-004` | Install Node LTS (22.x), pnpm, and Git | You | Before Sprint 1 | Sprint 1 |
| `PRE-005` | Create the GitHub repository (private) and push an empty initial commit | You | Sprint 1 day 1 | Sprint 1 |
| `PRE-006` | Create the Supabase project; record the URL and anon key in `.env.local` | You | Sprint 1 | Sprint 2 |
| `PRE-007` | Create the Vercel project and connect it to the repo | You | Sprint 1 | — |
| `PRE-008` | Decide headphones vs. instrument speakers as the default audio path (`FR-SYS-002` calibration depends on it) | You | Sprint 1 | Sprint 1 |
| `PRE-009` | Decide styling approach once — Tailwind or CSS Modules — and never revisit it | You | Sprint 1 | Sprint 1 |
| `PRE-010` | Record the child's first-session baseline: what they can already do at the piano, if anything | You | Before Sprint 2 | Sprint 2 content |
| `PRE-011` | Choose rented Mac vs. cloud build service, and confirm an Apple Developer account is obtainable | You | Before Sprint 5 | Sprint 5 |

**Two open questions remain from the architecture review**, neither blocking:

- **Headphones or the instrument's own speakers?** (`PRE-008`) Assumed: the
  instrument's speakers, which relaxes `NFR-003` considerably. If headphones become
  primary, app audio moves onto the critical path and latency matters much more.
- **Will this ever be shared beyond the family?** Assumed no. Yes would turn
  licensing rigour, privacy posture and Vercel's non-commercial Hobby terms from
  footnotes into requirements.

---

## 2. Repository scaffold

```
duokeys/
├── .github/workflows/ci.yml
├── docs/                          ← this document set
│   ├── 00-INDEX.md
│   ├── 01-TECHNICAL-ARCHITECTURE.md
│   ├── 02-FUNCTIONAL-SPECIFICATION.md
│   ├── 03-SPRINT-PLAN.md
│   ├── 04-TEST-SCENARIOS.md
│   └── 05-ENGINEERING-HANDBOOK.md
├── content/
│   ├── sources/                   ← .musicxml, .mxl, .mid, hand-authored .json
│   ├── licences.json              ← build fails without a matching entry
│   └── build/
│       ├── ingest.ts              ← the 8-stage pipeline (TA-CNT-001)
│       ├── parse.ts
│       ├── normalise.ts
│       ├── segment.ts
│       └── analyse.ts             ← difficulty scoring (TA-CNT-002)
├── public/
│   ├── content/                   ← GENERATED, git-ignored
│   └── samples/                   ← piano samples for Tone.js
├── src/
│   ├── core/                      ← PURE. Zero platform imports. (TA-PORT-001)
│   │   ├── time/
│   │   │   ├── types.ts           ← Millis, Seconds, Ticks brands (TA-CLK-001)
│   │   │   ├── masterClock.ts     ← (TA-CLK-002)
│   │   │   ├── drift.ts           ← EMA correction (TA-CLK-003)
│   │   │   └── calibration.ts     ← median tap-along (TA-CLK-004)
│   │   ├── midi/
│   │   │   ├── decode.ts          ← (TA-MID-002)
│   │   │   ├── pedalTracker.ts    ← (TA-MID-004)
│   │   │   └── noteStream.ts      ← (TA-MID-001)
│   │   ├── match/
│   │   │   ├── types.ts
│   │   │   ├── waitMatcher.ts     ← (TA-MAT-002)
│   │   │   ├── timedMatcher.ts    ← (TA-MAT-003)
│   │   │   └── tolerance.ts       ← (TA-MAT-006)
│   │   ├── grade/
│   │   │   ├── grade.ts           ← (TA-GRD-001)
│   │   │   ├── stars.ts           ← (TA-GRD-002)
│   │   │   └── evenness.ts        ← (TA-GRD-003)
│   │   ├── content/               ← Piece/Arrangement/Track/Section types
│   │   ├── progression/           ← unlock graph, spaced repetition
│   │   └── generate/
│   │       ├── sightReading.ts    ← (FR-STU-010)
│   │       └── hanon.ts           ← (FR-STU-007)
│   ├── adapters/
│   │   ├── ports.ts               ← THE five interfaces (TA-PORT-002)
│   │   ├── midi/webMidi.ts
│   │   ├── audio/webAudio.ts
│   │   ├── storage/idb.ts
│   │   ├── sync/supabase.ts
│   │   ├── content/static.ts
│   │   └── fake/                  ← deterministic doubles (TA-PORT-004)
│   ├── ui/                        ← presentational React only
│   │   ├── keybed/
│   │   ├── falling/
│   │   ├── notation/
│   │   └── shared/
│   ├── runtime/
│   │   ├── bootstrap.ts           ← composition root (TA-APP-002)
│   │   └── stores/                ← Zustand session state
│   └── app/                       ← Next.js App Router routes (TA-APP-003)
├── test/
│   ├── fixtures/                  ← PerformanceFixture .json files
│   └── golden/                    ← TS-G-* expected grades
├── eslint.config.js               ← boundary rules (TA-PORT-005)
├── vitest.config.ts
├── playwright.config.ts
└── next.config.js                 ← must stay `output: 'export'` compatible
```

---

## 3. Definition of Done

A story is done when **all** of the following are true. No partial credit.

1. Acceptance criteria in the story are met.
2. The `TS-*` scenarios referenced by the story pass.
3. Coverage targets for any touched `core/` module still hold (§ TEST coverage table).
4. Boundary lint passes — no new platform import in `core/`, no `ui/` import in `adapters/`.
5. TypeScript compiles with `strict` and `noUncheckedIndexedAccess`, zero `any` added.
6. The feature works with the network off, unless it is a sync feature.
7. If it touches the render loop, a 5-minute session holds 60 fps (`NFR-002`).
8. If it touches tolerance or grading constants, golden fixtures are updated
   **deliberately and reviewed** — never silently.
9. The documentation gate has been run: `node scripts/docs-check.mjs` passes, and
   every file named by the impact matrix in `CLAUDE.md` § 1.2 has been updated —
   the Markdown **and** its `docs/html/` rendering. The completion message names
   each file touched, and each matrix file deliberately skipped, with the reason.
10. It has been played at the actual piano at least once.

That last one is not ceremony. A grading change that passes every fixture and feels
wrong under the hands is still wrong.

---

## 4. Engineering conventions

### TypeScript

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any`. `unknown` plus a narrowing function where a boundary is genuinely untyped.
- Branded types for every unit that can be confused with another (`Millis`,
  `Seconds`, `Ticks`, `MidiPitch`). This is not pedantry — mixing milliseconds and
  seconds is the single most likely silent bug in this codebase.
- Discriminated unions over boolean flags for anything with more than two states.

### Purity in `core/`

- No `Date.now()`, no `Math.random()`, no `performance.now()` — all three are
  injected. A test that cannot reproduce a grade is not a test.
- No mutation of inputs. Functions return new values.
- Every exported function in `core/` is testable with plain values in a node
  process, with no setup.

### Naming

- Time-carrying values name their unit: `deltaMs`, `startTick`, `atSeconds`.
- Booleans read as assertions: `isSustaining`, `hasCompleted`.
- Ports are nouns (`MidiBackend`); adapters name their platform (`WebMidiBackend`).

### Commits and branches

- `main` is always deployable and always green.
- One branch per story, named `us-2.13-note-ninja`.
- Commit messages reference the story: `US-2.13: response-time bands for Note Ninja`.
- Squash-merge to `main`.

### CI (`.github/workflows/ci.yml`)

Runs on every push:

```
typecheck  → tsc --noEmit
lint       → eslint (includes boundary rules, TA-PORT-005)
test:unit  → vitest run  (TS-U-*, TS-I-*, TS-G-*)
docs:check → node scripts/docs-check.mjs
build      → next build
test:e2e   → playwright  (TS-E-*, pre-merge only)
```

CI has no MIDI device and no audio hardware, and needs neither (ADR-005).

---

## 5. Content authoring guide

Most first-year child content is hand-authored, and a five-finger tune is about
twenty notes — writing it directly is faster than sourcing it.

### Minimal authored piece

```json
{
  "id": "mary-had-a-little-lamb",
  "title": "Mary Had a Little Lamb",
  "composer": "Traditional",
  "licenceId": "public-domain-traditional",
  "arrangements": [{
    "id": "mary-d1",
    "difficulty": 1,
    "tempoMap": [{ "atTick": 0, "bpm": 80 }],
    "timeSig": [4, 4],
    "keySig": "C",
    "tracks": [{
      "id": "rh", "role": "melody", "hand": "R",
      "notes": [
        { "pitch": 64, "startTick": 0,    "durationTicks": 480, "finger": 3 },
        { "pitch": 62, "startTick": 480,  "durationTicks": 480, "finger": 2 },
        { "pitch": 60, "startTick": 960,  "durationTicks": 480, "finger": 1 },
        { "pitch": 62, "startTick": 1440, "durationTicks": 480, "finger": 2 }
      ]
    }]
  }]
}
```

`groupId`, `sections` and `analysis` are generated by `ingest` — do not hand-write
them.

### Authoring rules for difficulty 1–2

| Rule | Why |
|---|---|
| Stay within one five-finger position per piece | ADR-008 stage 1; thumb-under is a later skill |
| Centre on middle C (pitch 60) | The landmark everything else is read against |
| Quarter and half notes only at difficulty 1 | Rhythmic vocabulary is the second axis of difficulty |
| One hand at a time until difficulty 3 | Hand independence is the hardest axis |
| No accidentals below difficulty 4 | |
| 8–16 bars maximum | A section must be completable in under a minute (`FR-EXP-004`) |
| Always add fingerings | Bad habits are cheaper to prevent than to fix |
| Only melodies the child already knows by ear | They can self-correct against memory, which is the whole trick |

### Licence entries

```json
{
  "public-domain-traditional": {
    "type": "public-domain",
    "reason": "Traditional melody, pre-1900, no known author",
    "sourceUrl": "https://example.org/...",
    "verifiedOn": "2026-09-02"
  }
}
```

The build fails on any piece whose `licenceId` has no entry (`TA-CNT-005`).

---

## 6. Sprint 0 kit

Sprint 0 is deliberately *not* the repo. It is one HTML file you open with a
double-click, because framework setup is exactly the kind of work that feels like
progress while answering nothing.

**What it must contain:**

1. `navigator.requestMIDIAccess()` and a device list.
2. A log of every message: raw bytes, decoded meaning, `event.timeStamp`.
3. A `<canvas>` rectangle that fills on note-on and clears on note-off.
4. A Tone.js note triggered on key press.
5. A metronome click plus a tap-along that prints the **median** offset over 16 taps.
6. A counter for `0xFE` active sensing messages per second.
7. A CC64 state readout.

**What to record in `docs/sprint-0-findings.md`:**

- Instrument model, connection method, enumerated device name.
- Measured median round-trip latency, and its spread.
- Whether note-off arrives as `0x80` or as `0x90` with velocity 0.
- Active sensing rate.
- Anything surprising. Especially anything surprising.

---

## 7. Deliverable status

| Deliverable | Status |
|---|---|
| Technical architecture (`TECH`) | ✅ Complete |
| Functional specification (`FUNC`) | ✅ Complete |
| Sprint plan and user stories (`SPRINT`) | ✅ Complete |
| Test scenarios (`TEST`) | ✅ Complete |
| Engineering handbook (`ENG`) | ✅ Complete |
| Repo scaffold | ⬜ Sprint 1, `US-1.01` |
| Sprint 0 spike file | ⬜ Next action |
| `sprint-0-findings.md` | ⬜ Output of Sprint 0 |
| Content licence register | ⬜ Sprint 2, `US-2.08` |
