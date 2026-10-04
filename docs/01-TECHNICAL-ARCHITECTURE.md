# DuoKeys — Technical Architecture

**Document ID:** TECH
**Version:** 1.0
**Date:** 2 September 2026
**Status:** Baselined — all platform decisions closed
**Supersedes:** narrative sections 04–12 of `DuoKeys_Architecture.html`

---

## How to read this document

Every component, rule and constraint here carries a stable ID. Functional
requirements (`FR-*` in [02-FUNCTIONAL-SPECIFICATION.md](02-FUNCTIONAL-SPECIFICATION.md))
reference these IDs to say *how* they are realised. User stories (`US-*`) and test
scenarios (`TS-*`) reference both.

**ID scheme for this document:**

| Prefix | Subsystem |
|---|---|
| `TA-PORT-*` | Ports, adapters, module boundaries |
| `TA-CLK-*` | Clock and time domains |
| `TA-MID-*` | MIDI input pipeline |
| `TA-AUD-*` | Audio output and latency |
| `TA-MAT-*` | Matcher (note/chord recognition) |
| `TA-GRD-*` | Grading and scoring |
| `TA-REN-*` | Renderers (canvas, notation) |
| `TA-DAT-*` | Local data model and persistence |
| `TA-SYN-*` | Cloud sync and accounts |
| `TA-CNT-*` | Content build pipeline |
| `TA-APP-*` | App shell, runtime, composition |
| `ADR-*` | Architecture decision records |
| `NFR-*` | Non-functional requirements and budgets |

---

## 0. Architecture decision records

These are the decisions that constrain everything below. Each is closed; reopening
one is a deliberate act, not a drift.

### ADR-001 — Target platform is a desktop browser, not iPad

**Status:** Accepted, 2 Sep 2026
**Context:** The original brief assumed an iPad on the music stand. The Web MIDI
API is not implemented in Safari or any WebKit-backed browser on any platform —
WebKit bug #107250 has been open since January 2013, was last touched July 2025,
and has no roadmap. This is distinct from native CoreMIDI, which iOS has had since
2010 and which is what GarageBand, Cubasis and every other iPad MIDI app uses. A
web app on iPad cannot reach the piano; a native app can.

**Decision:** Build and run on a Windows laptop in Chrome or Edge, which support
Web MIDI natively. The iPad remains reachable later via a Capacitor shell with a
Swift CoreMIDI plugin (see ADR-002), as an additive sprint.

**Consequences:** Development environment is unblocked immediately with zero
platform work. Physical ergonomics are worse — a laptop on or beside a piano is
less pleasant than a tablet on the stand. Accepted as the correct trade for a
first version whose real risk is whether the timing feels good at all.

### ADR-002 — Keep the iPad door open at near-zero cost

**Status:** Accepted, 2 Sep 2026
**Decision:** Two constraints, both of which the architecture wants for independent
reasons, preserve the iPad path:

1. All MIDI access routes through the single `MidiBackend` port (TA-PORT-002),
   enforced by lint rule (TA-PORT-005).
2. No Next.js server-only features are reachable at runtime — no server actions,
   no API routes on the hot path, `output: 'export'` compatible.

**Consequences:** Extending to iPad later is a Capacitor shell (~0.5–1 day) plus a
Swift CoreMIDI plugin implementing `MidiBackend` (3–5 days experienced, 1.5–2 weeks
first time). Roughly 90–95% of the codebase transfers unchanged. **Blocker to note
now:** Xcode is macOS-only, so iOS builds require a rented or cloud Mac (MacinCloud)
or a cloud build service (Codemagic). Arrange this *before* committing to Sprint 5,
not during it.

### ADR-003 — Local-first storage, cloud sync additive

**Status:** Accepted, 2 Sep 2026
**Context:** Practice happens wherever the piano is, often on the worst Wi-Fi in the
house. A spinner between "sit down" and "play" kills the habit faster than any
missing feature. Separately, Supabase pauses free-tier projects after seven days
without API traffic.

**Decision:** IndexedDB is the source of truth. Every practice feature works with
the network off. Supabase is an additive sync target, never a read dependency on
the practice path. Content ships as static JSON and needs no database at all.

### ADR-004 — Cloud sync is built in Sprint 2, not deferred

**Status:** Accepted, 2 Sep 2026 (revises earlier "optional, Sprint 4" position)
**Context:** User confirmed sync is wanted from the start — the failure mode being
guarded against is a lost or reset laptop taking a year of progress with it.

**Decision:** Supabase project is created in Sprint 1 (so the seven-day pause clock
never becomes a surprise). Auth and the outbox flush land in Sprint 2 alongside
profiles, since profiles are when an account layer first makes sense.

**Consequences:** ADR-003 is unchanged — this moves *when* sync is wired, not
whether IndexedDB remains authoritative.

### ADR-005 — Pure core, thin adapters (ports & adapters / hexagonal)

**Status:** Accepted
**Decision:** `core/` contains the clock, matcher, grader, content model and
progression logic as pure TypeScript with zero imports from React, the DOM, Web
MIDI, Web Audio, IndexedDB or Supabase. Platform contact lives in `adapters/`,
behind five port interfaces.

**Consequences:** The hard parts of the product are exhaustively testable in CI
with no piano, no audio hardware and no browser. This is the single decision that
makes TS-U-* possible at all.

### ADR-006 — Audio clock is the master time domain

**Status:** Accepted
**Decision:** `AudioContext.currentTime` (seconds, monotonic, audio-hardware-locked)
is canonical. Wall time (`performance.now()`, milliseconds) is corrected toward it
via an EMA. Musical time (ticks, 480 PPQ) converts through the tempo map.

**Rationale:** What the player hears is generated by the audio clock. Grading
against the wall clock while sounding against the audio clock accumulates drift
that shows up as "the app says I'm late and I know I wasn't."

### ADR-007 — Tolerance windows are tempo-relative with an absolute floor

**Status:** Accepted
**Context:** The original spec proposed a flat ±150 ms. At 60 bpm that is a
generous ninth of a beat; at 160 bpm it is nearly half a beat and grades a wrong
subdivision as correct.

**Decision:** `tolerance = max(floorMs, beatMs × fraction)` per tier. See TA-MAT-006.

### ADR-008 — Content sequence tracks mainstream beginner method pedagogy

**Status:** Accepted, 2 Sep 2026
**Context:** No formal lessons are booked, but the app should not invent a bespoke
teaching order that would conflict if lessons start later.

**Decision:** The `difficulty 1–5` scale maps onto the four-stage progression that
Faber Piano Adventures, Alfred and Bastien broadly agree on: pre-staff five-finger
position at middle C → neighbouring five-finger positions → landmark-note reading →
full grand staff. Re-keying to a specific method book later is a lookup table, not
a content rewrite.

### ADR-009 — Instrument is a full 88-key with sustain pedal

**Status:** Accepted, 2 Sep 2026
**Decision:** `Profile.keyboardRange` remains in the model as a safety net for a
future second instrument, but no content filtering or forced transposition is
required for the primary instrument.

---

## 1. Module boundaries

### TA-PORT-001 — Four-layer structure

Dependencies point inward only. Nothing in an inner layer may import from an outer
one.

```
runtime/     composition root — wires adapters into core, owns React tree
   │
   ├── ui/        presentational React. Props in, callbacks out. No business logic.
   │
   ├── adapters/  the only code that touches a platform API
   │
   └── core/      pure TypeScript. Zero platform imports. 100% testable in node.
```

| Layer | May import from | Must never import |
|---|---|---|
| `core/` | `core/` only | react, next, dom types, navigator, window, indexeddb, supabase |
| `adapters/` | `core/`, platform APIs | `ui/`, `runtime/` |
| `ui/` | `core/` types, react | `adapters/`, `runtime/`, platform APIs |
| `runtime/` | everything | — |

### TA-PORT-002 — The five ports

Every platform capability enters through exactly one interface. These are the
seams that make ADR-002 cheap.

```ts
// adapters/ports.ts — the entire platform surface of the application

export interface MidiBackend {
  listInputs(): Promise<MidiInputInfo[]>;
  open(id: string): Promise<void>;
  close(): Promise<void>;
  onMessage(cb: (msg: RawMidiMessage) => void): Unsubscribe;
  onStateChange(cb: (s: MidiConnectionState) => void): Unsubscribe;
}

export interface AudioBackend {
  now(): Seconds;                                  // the master clock (ADR-006)
  playNote(pitch: MidiPitch, velocity: number, at?: Seconds): VoiceHandle;
  stopNote(h: VoiceHandle, at?: Seconds): void;
  playSample(id: SampleId, at?: Seconds): void;    // rewards, metronome, cues
  setMasterGain(g: number): void;
  resume(): Promise<void>;                          // user-gesture unlock
}

export interface StorageBackend {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, value: T): Promise<void>;
  query<T>(store: StoreName, index: string, range: KeyRange): Promise<T[]>;
  delete(store: StoreName, key: string): Promise<void>;
  transaction<T>(stores: StoreName[], fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface SyncBackend {
  signIn(email: string): Promise<void>;             // passwordless link
  signOut(): Promise<void>;
  currentUser(): Promise<SyncUser | null>;
  push(ops: OutboxOp[]): Promise<PushResult>;
  pull(since: Cursor): Promise<PullResult>;
}

export interface ContentBackend {
  index(): Promise<ContentIndex>;
  arrangement(id: ArrangementId): Promise<Arrangement>;
}
```

### TA-PORT-003 — Adapter implementations, v1

| Port | v1 adapter | iPad adapter (ADR-002) |
|---|---|---|
| `MidiBackend` | `WebMidiBackend` — Web MIDI API | `CoreMidiBackend` — Capacitor plugin, Swift |
| `AudioBackend` | `WebAudioBackend` — Tone.js sampler | unchanged |
| `StorageBackend` | `IdbBackend` — IndexedDB via `idb` | unchanged |
| `SyncBackend` | `SupabaseBackend` | unchanged |
| `ContentBackend` | `StaticContentBackend` — fetch + cache | unchanged |

### TA-PORT-004 — Test doubles are first-class

Every port ships a deterministic fake in `adapters/fake/`. `FakeMidiBackend`
replays a `PerformanceFixture` (a recorded or hand-authored note stream) against a
`FakeClock`. This is the mechanism behind the entire `TS-U-*` and `TS-I-*` suite.

### TA-PORT-005 — Boundary enforcement is a lint rule, not a convention

```js
// eslint.config.js
{
  files: ['src/core/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [
        { group: ['react', 'react-*', 'next', 'next/*'],  message: 'core must stay pure — see TA-PORT-001' },
        { group: ['@supabase/*', 'idb', 'tone', 'webmidi'], message: 'core must stay pure — use a port (TA-PORT-002)' },
        { group: ['../adapters/*', '../ui/*', '../runtime/*'], message: 'dependencies point inward only' },
      ],
    }],
  },
}
```

A second rule blocks `adapters/**` from importing `ui/**` or `runtime/**`.
CI fails on violation. This is what stops the iPad path silently closing.

---

## 2. Time and the clock

### TA-CLK-001 — Three time domains, never mixed implicitly

| Domain | Unit | Source | Role |
|---|---|---|---|
| **Wall** | `Millis` | `performance.now()` | MIDI event arrival timestamps |
| **Audio** | `Seconds` | `AudioContext.currentTime` | **Master** (ADR-006) — playback, scheduling, grading |
| **Musical** | `Ticks` @ 480 PPQ | tempo map | Content authoring, matcher expectations |

Branded types prevent accidental mixing:

```ts
export type Millis  = number & { readonly __brand: 'Millis' };
export type Seconds = number & { readonly __brand: 'Seconds' };
export type Ticks   = number & { readonly __brand: 'Ticks' };
```

### TA-CLK-002 — MasterClock

Owns the mapping between all three domains and the drift correction between wall
and audio.

```ts
export class MasterClock {
  constructor(private audio: AudioClock, private tempoMap: TempoMap) {}

  nowAudio(): Seconds;
  audioToTicks(t: Seconds): Ticks;
  ticksToAudio(t: Ticks): Seconds;

  start(atTick: Ticks): void;
  pause(): void;
  setTempoScale(scale: number): void;  // 0.30 – 1.00, see FR-STU-004

  // Wait-mode hold: freeze musical time on a tick (the pending chord) until
  // the matcher advances, then carry on. Positions stay anchored to "now", so
  // notes already past the line keep their distance from it.
  holdAt(tick: Ticks): void;
  resume(): void;
  get isHeld(): boolean;

  // FR-STU-003 — indefinite measure-range loop, driven by playback position
  // reaching the loop end, independent of whether the notes played were
  // correct (US-3.06 grades the pass separately, from Grade.accuracy).
  setLoop(startTick: Ticks, endTick: Ticks): void;  // half-open [startTick, endTick)
  clearLoop(): void;
  get loopRange(): { startTick: Ticks; endTick: Ticks } | undefined;
  checkLoop(): boolean;  // poll once per frame; restarts at loopStart and
                          // returns true the instant playback crosses loopEnd
}
```

The wall→audio EMA correction (TA-CLK-003) lives on the separate `DriftTracker`
class (`wallToAudio`, `src/core/time/drift.ts`), not on `MasterClock` —
`MasterClock` itself only ever reads audio time via the injected `AudioClock`.

### TA-CLK-003 — Drift correction

`performance.now()` and `AudioContext.currentTime` run off different oscillators
and drift measurably over a ten-minute session. On every MIDI event, the observed
offset `audioNow - (wallNow / 1000)` updates an exponential moving average
(α = 0.05). `wallToAudio` applies the smoothed offset. Raw offsets are never used
directly — a single scheduler hiccup would otherwise jerk the timeline.

### TA-CLK-004 — Latency calibration

Total round-trip latency (key press → MIDI transport → browser event → audio
output → ear) is instrument- and machine-specific and typically 15–60 ms. It must
be measured, not assumed.

**Procedure:** the app plays a steady click; the player taps any key on each click
for sixteen beats. The **median** signed offset (median, not mean — one fumbled tap
must not skew it) is stored as `Profile.latencyOffsetMs` and subtracted from every
subsequent event timestamp before grading.

Re-run on: first launch, instrument change, and on demand from settings.

### TA-CLK-005 — Look-ahead scheduling

Audio events are scheduled 100 ms ahead into the Web Audio graph on a 25 ms
`setInterval` tick. Never schedule at `currentTime` — jitter becomes audible.

---

## 3. MIDI pipeline

### TA-MID-001 — Stages

```
WebMidiBackend
  → decode        raw bytes → typed MidiEvent (TA-MID-002)
  → latencyShift  subtract Profile.latencyOffsetMs (TA-CLK-004)
  → pedalTracker  apply CC64 sustain semantics (TA-MID-004)
  → noteStream    pair note-on/note-off into NoteEvent with duration
  → PerformanceEvent stream → matcher (TA-MAT-*) + renderer (TA-REN-*)
```

Everything after `WebMidiBackend` lives in `core/` and is pure.

### TA-MID-002 — Event decoding

Handle, at minimum: Note On (0x90), Note Off (0x80), **Note On with velocity 0 as
Note Off** (many instruments never send 0x80), Control Change (0xB0) for CC64
sustain / CC66 sostenuto / CC67 soft, and Active Sensing (0xFE) which must be
swallowed silently — some instruments emit it 3× per second and it will flood any
naive log.

### TA-MID-003 — Timestamp source

Use `MIDIMessageEvent.timeStamp` (a `DOMHighResTimeStamp` from the same origin as
`performance.now()`), **not** `performance.now()` read inside the handler. The
former is captured closer to hardware; the latter includes JS event-loop delay,
which is exactly the noise being measured out.

### TA-MID-004 — PedalTracker

Sustain makes "key released" and "note stopped sounding" two different events, and
the product needs both:

- **Key up** → grades articulation and note duration (`FR-STU-006`).
- **Note stopped sounding** → drives the visual note-off in the renderer.

```ts
class PedalTracker {
  private sustaining = false;
  private held = new Set<MidiPitch>();       // physically down
  private sustained = new Set<MidiPitch>();  // released but still sounding

  noteOn(p): void;
  noteOff(p): { keyUp: true; stoppedSounding: boolean };
  cc64(value: number): { released: MidiPitch[] };  // ≥64 = down
}
```

A pedal-down release moves the pitch from `held` to `sustained`; pedal-up flushes
`sustained` and emits the real note-offs.

### TA-MID-005 — Connection resilience

`onStateChange` must handle mid-session disconnect (cable knocked, instrument
sleeps). On disconnect: pause the session, hold state, show a calm reconnect
prompt (`FR-SYS-004`) — never lose the attempt in progress.

---

## 4. Audio

### TA-AUD-001 — Two possible sound sources

| Source | Latency | Used when |
|---|---|---|
| The instrument's own speakers | ~0 ms (local sound generation) | Default. Instrument produces its own sound. |
| App audio via Tone.js sampler | 15–60 ms + calibration | Metronome, backing tracks, muted-hand playback, rewards, Explorer sounds |

Since the instrument makes its own sound, app audio is *additive* — the app never
has to synthesise the player's own notes on the critical path. This materially
relaxes the latency budget (`NFR-003`).

### TA-AUD-002 — Sampler

Tone.js `Sampler` with a small salamander-style piano set, lazily loaded, used for
backing parts and hands-separate playback (`FR-STU-005`). Not loaded on the
Explorer route (`NFR-006`).

### TA-AUD-003 — Context unlock

`AudioContext` starts suspended until a user gesture. The runtime resumes it on
the first interaction and shows a single "tap to start" affordance if suspended.

---

## 5. Matcher

The matcher decides whether what was played matches what was expected. Two modes,
sharing one interface.

### TA-MAT-001 — Interface

```ts
export interface Matcher {
  expect(events: ExpectedNote[]): void;
  consume(e: PerformanceEvent): MatchResult;
  state(): MatcherState;
  reset(): void;
}

export type MatchResult =
  | { kind: 'correct';    expectedId: string; deltaMs: number }
  | { kind: 'extra';      pitch: MidiPitch }          // note not expected here
  | { kind: 'wrong';      expectedId: string; pitch: MidiPitch; error: PitchErrorKind }
  | { kind: 'ignored' };                              // e.g. below velocity floor

export type PitchErrorKind = 'neighbour' | 'octave' | 'other';
```

### TA-MAT-002 — WaitMatcher (no clock)

The default and, for a beginner, the *only* mode for the first months. The stream
freezes at the hit line until the expected chord-set is fully satisfied. There is
no timing judgement at all — only pitch.

- Maintains `pending: Set<MidiPitch>` for the current group.
- Any note in `pending` → remove it; when empty, advance.
- Any note not in `pending` → `extra`, does not block advancement.
- No timeouts. A six-year-old may take thirty seconds to find F♯ and that is fine.

### TA-MAT-003 — TimedMatcher

Greedy nearest-match against expected events within a tolerance window.

- For an incoming note, find the nearest unconsumed expected event with the same
  pitch within `2 × tolerance.loose`.
- **Monotonic constraint:** never match an expected event earlier than one already
  matched. This prevents a late note "stealing" an earlier slot and cascading.
- Unmatched expected events past their window → `missed`.
- Unmatched played notes → `extra`.

### TA-MAT-004 — Chord grouping

Notes within **30 ticks** (≈31 ms at 120 bpm) of each other in the content are one
`groupId` — a single musical decision. The matcher advances per group, not per
note, so a rolled chord is one event, not three errors.

### TA-MAT-005 — Velocity floor

Notes below velocity 12 are `ignored`. A small hand resting on the keybed, or a
sleeve, should not register as a wrong note.

### TA-MAT-006 — Tolerance tiers (ADR-007)

```ts
const TOLERANCE = {
  perfect: { floorMs: 45,  fraction: 0.08 },
  good:    { floorMs: 90,  fraction: 0.16 },
  loose:   { floorMs: 160, fraction: 0.30 },
} as const;

// tolerance = max(floorMs, beatMs * fraction)
export const windowFor = (tier: Tier, bpm: number): number =>
  Math.max(TOLERANCE[tier].floorMs, (60_000 / bpm) * TOLERANCE[tier].fraction);
```

At 60 bpm, `good` = 160 ms. At 160 bpm, `good` = 90 ms. Both feel right; a flat
150 ms feels right at neither.

Explorer mode multiplies all windows by `Profile.toleranceScale` (default **1.6**
for the child, **1.0** for the adult).

### TA-MAT-007 — ChordMatcher (pitch-class set matching)

`US-3.13` (`FR-STU-012`). Different in kind from `TA-MAT-002`/`003`: those match a
*stream position*; this matches an *unordered set*, because a suggested chord has
no sequence to follow.

- Target = the current `ChordEntry.midiNotes` (`TA-CNT-006`) reduced to pitch
  classes mod 12 — **octave-invariant**, so a C in any octave counts.
- Incoming notes accumulate into a played set using the same "one decision"
  co-incidence window as `TA-MAT-004`'s chord grouping, expressed in wall time
  (150 ms) rather than ticks, since chord/progression playback has no tempo map
  driving it.
- `TA-MAT-005`'s velocity floor applies unchanged.
- Result is `complete` (played set ⊇ target set) or `partial` (still missing
  pitch classes) — no `wrong`, no timeout. Extra non-chord notes don't block
  completion. This mirrors `FR-EXP-006`'s free-play philosophy: `FR-STU-012` is
  explicitly framed as low-pressure noodling, not a graded drill, so the matcher
  has no failure state to invent.

Delivered for `US-3.13` (`src/core/match/chordMatcher.ts`) exactly as specified
above — pitch-class-set matching, octave-invariant, 150 ms wall-time
co-incidence window, `complete`/`partial`/`ignored` result only. `ChordMatcher`
deliberately does not implement the `Matcher` interface (`TA-MAT-002`/`003`):
its result shape has no `wrong`/`extra`/group-position concept, so sharing the
interface would mean padding it with fields that never apply.

---

## 6. Grading

### TA-GRD-001 — Grade model

```ts
export interface Grade {
  accuracy: number;        // 0–1, correct notes / expected notes
  completion: number;      // 0–1, how far through the section
  rushDragMs: number;      // SIGNED mean offset — the actionable number
  timingRmsMs: number;     // unsigned spread — consistency
  evennessCv?: number;     // coefficient of variation of inter-onset intervals
  stars: 0 | 1 | 2 | 3;
  perNote: NoteResult[];
}
```

**`rushDragMs` is signed on purpose.** "You are 40 ms ahead of the beat" is a note
a teacher gives; "your RMS timing error is 40 ms" is not. RMS is kept for the
consistency trend, but the signed number is what the UI shows (`FR-STU-008`).
`describeRushDrag(rushDragMs)` (`src/core/grade/grade.ts`) turns the signed
number into that exact phrasing — negative is "ahead of the beat", positive is
"behind the beat" — so Studio never renders the bare signed millisecond value.

### TA-GRD-002 — Star thresholds

| Stars | Condition |
|---|---|
| 3 | accuracy ≥ 0.95 **and** completion = 1.0 |
| 2 | accuracy ≥ 0.80 **and** completion = 1.0 |
| 1 | completion ≥ 0.60 |
| 0 | otherwise |

Explorer mode floors at **1 star** on any completed attempt (`FR-EXP-007`). Sitting
down and finishing is the behaviour being reinforced at six years old.

### TA-GRD-003 — Evenness (Hanon and drills)

For exercises whose point is uniformity, compute the coefficient of variation of
inter-onset intervals: `stdev(iois) / mean(iois)`. Below 0.08 is even; above 0.20
is visibly lumpy. This is the only metric that makes Hanon practice measurable
rather than merely endured.

### TA-GRD-004 — Per-measure breakdown

`NoteResult[]` aggregates by measure so the dashboard can say "your left hand
rushes bar 5" rather than "you played it" (`FR-STU-009`).

### TA-GRD-005 — Note Ninja response-time bands

Note Ninja (`US-2.13`, `FR-EXP-005`) is a single isolated pitch per card, not a
section — it does not go through `Grade`/`stars.ts`. Its own, much smaller
classification:

```ts
type ResponseBand = 'fast' | 'correct' | 'hinted';

const FAST_THRESHOLD_SECONDS = 2;
const HINT_THRESHOLD_SECONDS = 6;
```

| Band | Elapsed time since the card was shown | Effect |
|---|---|---|
| `fast` | < 2 s | Streak continues, bonus shown |
| `correct` | 2–6 s | Streak continues |
| `hinted` | > 6 s | The key is highlighted; streak still continues |

Elapsed time is read from `AudioBackend.now()` directly (`ADR-006`'s own
source), not through `MasterClock` — Note Ninja has no tempo map or scheduled
notes for a clock to bind to. There is no losing band: a wrong key played
before the 6 s mark reveals the hint immediately rather than failing the card
(`FR-EXP-003`). Spaced-repetition scheduling for missed cards is `US-2.14`,
not this component.

### TA-GRD-006 — Articulation and duration feedback

`US-3.08` (`FR-STU-006`). Compares a held note's actual sounding duration
against its written duration and classifies the result:

```ts
type ArticulationOutcome = 'short' | 'even' | 'long';

const SHORT_RATIO = 0.7;
const LONG_RATIO = 1.3;

function classifyArticulation(actualMs: number, targetMs: number): ArticulationOutcome | undefined;
// ratio = actualMs / targetMs; < 0.7 -> short, > 1.3 -> long, else even.
// targetMs <= 0 -> undefined (unclassifiable).
```

**Actual duration** comes from `NoteStreamTracker`'s `NoteEvent.durationMs`
(`TA-MID-001`) — itself gated by `PedalTracker`'s key-up/stopped-sounding
distinction (`TA-MID-004`), so a note held past key-up on the pedal is not
misread as short. **Written duration** is `ContentNote.durationTicks`
converted to milliseconds through `MasterClock.ticksToAudio` (`ADR-006`) at
the attempt's current tempo scale, computed in `sessionStore` — not
`MasterClock` itself — as the difference between two `ticksToAudio` calls
made synchronously, which share the same fixed `startAudioTime` anchor and
so are drift-free without adding a new clock method.

`classifyArticulation` is a pure `core/` function; the open-note bookkeeping
(matching a note-on's correct match to its eventual release) lives in
`sessionStore`, the same split `TA-GRD-001`–`005` already use between pure
grading math and runtime wiring. A successfully classified note sets
`NoteResult.articulation`; the field is absent, not `undefined`-valued, when
unclassified (`exactOptionalPropertyTypes`, `CLAUDE.md` § 3). The last note
of an attempt may go unclassified if grading fires (on the matcher
completing) before that note's release event arrives — an accepted gap, not
a bug, since the field is optional throughout.

`describeArticulation(grade: Grade): string | undefined` (`src/core/grade/grade.ts`)
aggregates the classified notes in a `Grade` into one sentence for Studio's
post-attempt summary — "N notes cut short — try holding a little longer.",
the long-note equivalent, a clean-match message, or `undefined` when nothing
was classified (so Studio renders nothing rather than an empty line).

---

## 7. Renderers

### TA-REN-001 — Falling notes (Canvas 2D)

Explorer mode and Studio practice view. Bars descend toward a hit line drawn
directly above an on-screen keybed, so the screen→hands mapping is spatial and
needs no reading.

- Single `<canvas>`, `requestAnimationFrame`, no per-note DOM.
- Position is derived from `MasterClock.nowAudio()` every frame — never from an
  animation counter, which drifts.
- Off-screen notes are culled by a windowed index into the note array.
- Lanes fit the notes being played (`fitKeyboardRange`: 2 semitones of padding,
  at least two octaves, white-key aligned, clamped to `Profile.keyboardRange`),
  so a two-octave progression fills the screen instead of hugging one edge.
- Note letters: every falling bar and every wanted key carries its letter name
  (`noteName`, middle C = C4), and the chord screen prints a "Play now" line of
  the pending pitches, so nobody has to count keys on the diagram.
- Hit feedback: notes the matcher has accepted turn green with a tick (colour is
  never the only cue, `NFR-008`); the pending chord is outlined; a small keybed
  under the line marks wanted and played keys.
- **Hold at the line.** In wait mode `sessionStore` calls `MasterClock.holdAt`
  when the current tick reaches the pending chord's tick and `resume` when the
  matcher moves on, so notes stop on the line until played correctly. A
  per-session toggle turns it off; the sampler accompaniment also disables it,
  because that audio is scheduled in advance.
- Fall speed is the tempo-scale slider (`FR-STU-004`) on the chord screen; the
  canvas also takes a `pixelsPerSecond` prop, with no UI yet.

### TA-REN-002 — Pitch→x mapping

Worth isolating and unit-testing (`TS-U-REN-*`): white keys tile uniformly, black
keys are inset and overlap, the pattern repeats every octave with 2–3 grouping.
Derived once from `Profile.keyboardRange`.

### TA-REN-003 — Notation (OpenSheetMusicDisplay)

Studio mode only. OSMD is BSD-3-Clause. Matcher-driven cursor; per-note colouring
applied after an attempt, not during (repainting the SVG mid-performance is the
fastest way to drop frames).

OSMD renders MusicXML, not `ContentNote[]` directly, so a pure `core/` function
(`toMusicXml.ts`) converts one track of an `Arrangement` to a MusicXML document:
`divisions=480` is set equal to PPQ so `durationTicks` maps 1:1 to `<duration>`;
a small duration→type lookup (60/120/240/480/960/1920 ticks → 32nd…whole) covers
every value currently produced by `content/sources/*.json`; pitch spelling is
sharp-only (no key-signature-aware enharmonics); measures are bucketed by
`floor(startTick / ticksPerMeasure)` from `timeSig`. The converter documents and
enforces its own limits — single voice, no synthesized rests for gaps, no
unmapped duration — by throwing rather than silently misrendering when a future
content file violates them.

**Chord score view (`FR-STU-015`).** `core/content/chordScoreXml.ts`
(`chordsToMusicXml`) turns a block-chord arrangement into a grand-staff MusicXML
document, one whole-note measure per chord group (treble at or above middle C,
bass below), the chord symbol as a direction. `NotationView` takes a
`layout="chords"` prop: one horizontal stave line, no auto-follow, the wrapper
scrolled so the cursor sits a quarter of the way across, and the cursor stepped
once per matcher group, so the score moves left to right only on correct notes.
Limits: block chords only, key of C with sharp spelling, no per-note hit colours.

### TA-REN-004 — Route-level code splitting

OSMD is large. It is dynamically imported on Studio routes only and must never
appear in the Explorer bundle (`NFR-006`).

---

## 8. Data model

### TA-DAT-001 — Content hierarchy

The original three-table sketch (`profiles`, `lessons`, `progress_logs`) cannot
express the micro-quest feature. The corrected model:

```
Piece            the work — "Ode to Joy"
  └── Arrangement    one playable realisation at a difficulty (1–5)
        └── Track       one hand or one player's part, with a `role`
              └── Section  a phrase, or a 2-bar fallback — the quest unit
```

```ts
interface Piece        { id; title; composer?; tags: string[]; licenceId: string }
interface Arrangement  { id; pieceId; difficulty: 1|2|3|4|5; tempoMap; timeSig;
                         keySig; tracks: Track[]; sections: Section[];
                         analysis: DifficultyBreakdown }
interface Track        { id; role: 'primo'|'secondo'|'lh'|'rh'|'melody'|'accomp';
                         hand?: 'L'|'R'; notes: ContentNote[] }
interface Section      { id; label; startTick; endTick; barRange: [number, number];
                         kind: 'quest' | 'reward' }
interface ContentNote  { id; pitch; startTick; durationTicks; groupId; trackId;
                         finger?: 1|2|3|4|5 }
```

`Section.kind` is required, not optional: `FR-EXP-004` ("whole-piece play is a
reward that unlocks after its sections are cleared, not the default demand")
is a hard distinction the quest map must always be able to make, and an
optional field would let a future content author silently omit it. Unlock
progression (`FR-PRO-002`) is derived at read time from `attempts` — `quest`
sections unlock in `startTick` order as soon as the previous quest's best
grade earns ≥ 1 star; the `reward` section unlocks once every `quest` section
in the arrangement has been cleared. This is computed by
`core/progression/progression.ts`, not written through to the `progression`
store (`TA-DAT-003`) — see that module's header comment for why.

### TA-DAT-002 — Attempt record

```ts
interface Attempt {
  id: string;              // uuid, client-generated
  profileId: string;
  arrangementId: string;
  sectionId?: string;
  startedAt: string;       // ISO
  durationMs: number;
  mode: 'wait' | 'timed';
  tempoScale: number;
  grade: Grade;
  events: NoteResult[];    // embedded, not a separate table
  appVersion: string;
}
```

Attempts are **append-only and immutable**. This is what makes sync trivial
(TA-SYN-003).

### TA-DAT-003 — IndexedDB stores

| Store | Key | Indexes | Notes |
|---|---|---|---|
| `profiles` | `id` | — | 2–4 rows, ever |
| `arrangements` | `id` | `pieceId, difficulty` | cache of static JSON |
| `attempts` | `id` | `profileId+startedAt`, `arrangementId` | append-only, the bulk of the data |
| `progression` | `profileId+arrangementId` | `profileId` | unlock state, best grade, SR schedule |
| `flashcards` | `profileId+cardId` | `profileId+dueAt` | Note Ninja spaced-repetition pool |
| `library` | `profileId+arrangementId` | `profileId` | saved / in-progress repertoire (`TA-DAT-007`) |
| `settings` | `profileId` | — | last-write-wins on sync |
| `outbox` | `seq` (auto) | — | pending sync ops |

### TA-DAT-004 — Profile

```ts
interface Profile {
  id: string;
  displayName: string;          // first name only (NFR-010)
  role: 'explorer' | 'student';
  keyboardRange: { low: MidiPitch; high: MidiPitch };   // ADR-009: 21–108
  latencyOffsetMs: number;      // TA-CLK-004
  toleranceScale: number;       // TA-MAT-006
  midiInputId?: string;
  avatar: string;               // emoji or asset id
}
```

### TA-DAT-005 — Content lives outside the database

Arrangements are static versioned JSON under `public/content/` with immutable cache
headers. Removes a class of loading states, works offline through the service
worker, costs nothing, and means the Supabase pause can never take the lessons down.

### TA-DAT-006 — Flashcard scheduling

Note Ninja (`US-2.13`/`US-2.14`) schedules its `flashcards` (`TA-DAT-003`) with a
five-box leitner-style scheme, pure and deterministic (`ADR-005` — no `Date.now()`;
the caller passes `nowMs`, sourced from `MasterClock` per `ADR-006`):

```ts
const INTERVAL_BY_BOX: Record<1 | 2 | 3 | 4 | 5, Millis> = {
  1: asMillis(0),
  2: asMillis(60_000),        // 1 minute — resurfaces within the same session
  3: asMillis(600_000),       // 10 minutes
  4: asMillis(86_400_000),    // 1 day
  5: asMillis(345_600_000),   // 4 days
};

function reviewCard(card: Flashcard, outcome: ResponseBand, nowMs: number): Flashcard;
```

Four outcomes, matching `TA-GRD-005`'s response bands:

| Outcome | Box change | Rationale |
|---|---|---|
| `fast` | `box + 1` (capped at 5) | Confident recall — space it out further |
| `correct` | unchanged | Solid but not instant — hold at the current interval |
| `hinted` | unchanged | The child still found it — not a regression, but not sped up either |
| `wrong` | reset to `1` | Needs to resurface immediately, same session |

Every pool pitch missing a card is seeded at box 1, due now, the first time it's
drawn. Card selection queries `flashcards` by the `profileId+dueAt` index
(`TA-DAT-003`) scoped to this profile, then filters to `dueAtMs <= now`
client-side — the compound index only narrows by its first field
(`profileId`), so `dueAt` filtering happens in the query layer, not the index
itself. This is FR-EXP-003-safe by construction: there is no `outcome` that
removes a card from the pool or blocks the child from continuing.

### TA-DAT-007 — Saved / in-progress repertoire

`US-3.15` (`FR-PRO-006`) — **delivered, Group D**. A small, user-curated
list, distinct from `progression`'s derived unlock/best-grade state
(`TA-DAT-001`) — the adult explicitly adds a piece here; nothing computes
membership.

```ts
interface LibraryEntry {
  profileId: string;
  arrangementId: string;
  status: 'wantToLearn' | 'learning' | 'learned';
  addedAtMs: Millis;
  updatedAtMs: Millis;
}
```

Delivered as a three-button status control (`LibraryControl`) inline in
`/studio`'s existing piece list, not a separate route (`/studio/library` now holds the song library, `FR-STU-016`)
`TA-APP-003` lists — a catalogue this small (nine pieces) doesn't need a
dedicated filtered view, and the toggle is one click either way. Status
changes are an idempotent `put` keyed `profileId+arrangementId` (a repeat
click on the active status clears it via `delete`, not a fourth "none"
status value). `src/runtime/stores/libraryStore.ts` (Zustand, `TA-APP-001`)
owns the loaded state.

Stored in the `library` store (`TA-DAT-003`), keyed `profileId+arrangementId`
so add/remove is an idempotent `put`/`delete`, not an append. Syncs
last-write-wins on `updatedAtMs`, the same policy class as `settings` and
`profiles` (`TA-SYN-003`) — this is small, rarely-changed, single-device-at-a-
time state, not append-only history like `attempts`.

---

## 9. Sync

### TA-SYN-001 — Shape

One direction at a time, never a merge algorithm:

```
IndexedDB (truth) ──push──▶ outbox ──▶ Supabase
IndexedDB          ◀──pull── Supabase   (only on a fresh device)
```

### TA-SYN-002 — Auth

Passwordless email link, adult account only. The child never has credentials. One
Supabase user owns all profiles in the household.

### TA-SYN-003 — Conflict policy

| Data | Policy | Why it works |
|---|---|---|
| `attempts` | **Append-only** — insert, never update | Two devices cannot conflict on rows neither mutates |
| `settings`, `profiles`, `library` | Last-write-wins on `updatedAt` | Changed rarely, by one adult, on one device at a time |
| `flashcards` | Last-write-wins on the outbox write time; on restore a local card is never overwritten | A `Flashcard` carries no timestamp of its own; the point is restoring a lost machine, not merging two live ones |
| `progression` | Recomputed from attempts | Derived state — never synced directly |

This is deliberately the boring choice. There is no CRDT, no vector clock, and no
merge UI, because the data model was shaped to make them unnecessary.

### TA-SYN-004 — Outbox

Every local write that needs syncing appends an op. A background flush drains it
when online and authenticated. Failure is silent and retried; sync never blocks or
interrupts a practice session.

`US-2.03` — **delivered**. `OutboxStorage` (`adapters/storage/outboxStorage.ts`)
decorates the `StorageBackend`: a write to a synced store (`profiles`, `attempts`,
`library`, `settings`) queues its op in the *same transaction* as the write.
`OutboxOp` is unchanged (`TA-PORT-002` untouched); the payload is an envelope —
`{ value, atMs }` for a put, `{ key, atMs }` for a delete — so the write time
travels with the op. If the outbox itself is unusable the local write still lands.
`SyncEngine` (`runtime/syncEngine.ts`) runs one flush at a time, in `seq` order,
batches of 100, and stops at the first failure so order is preserved; the result is
`synced` / `behind` / `signed-out` / `offline`, never an error shown to the child.
On a user's first sign-in on a device, existing local records are queued once.
Flush triggers: 2 s after a write, on the `online` event, and every 60 s.

Hardening (follow-up to `US-2.03`):

- **Clears propagate.** A pull returns changed rows, so a hard-deleted row is
  invisible to it. A `library` clear is therefore pushed as a tombstone
  (`deleted = true`, `updated_at_ms` = the clear time) under the same
  last-write-wins rule; a pull flags tombstoned rows and the engine removes the
  local entry unless it is newer. A re-add upserts `deleted = false`.
- **A bad op cannot wedge the queue.** The backend drops an op only when the
  server rejects it permanently (Postgres class 22 data exception or class 23
  integrity violation — retrying cannot help), logging the code and store but
  never the payload. Network errors, expired sessions, 5xx and a missing column
  during a rollout leave it queued. A dropped op's record stays in IndexedDB,
  which is the truth.
- **`flashcards` sync** (policy in `TA-SYN-003`, table in `TA-SYN-007`). Devices
  linked before this change re-queue their data once (the link flag is
  versioned); pushes are idempotent, so this is safe.

Remaining limitation: no hard-delete path exists for `profiles`, `settings` or
`flashcards` because nothing in the app deletes them; if that changes they need
tombstones too.

### TA-SYN-005 — Row-level security

Every Supabase table has RLS enabled with `auth.uid() = owner_id`. No exceptions,
verified by `TS-I-SYN-004`.

### TA-SYN-006 — Free-tier pause mitigation

Supabase pauses a free project after 7 days without API traffic. Because sync is
never on the read path (ADR-003), a paused project degrades to "sync is behind",
not "the app is down". A weekly scheduled ping is optional insurance, not a
requirement.

### TA-SYN-007 — Supabase schema

`US-1.03` — **delivered**. Project `DuoKeys` (org `SMTCB`, `eu-central-1`) is
live; migration `supabase/migrations/20261003130000_sync_schema.sql` is
applied. It creates the four tables `TA-SYN-003` says sync, mirroring
`TA-DAT-002`/`004`/`007` — `profiles`, `attempts`, `library`, `settings`.
`progression` is derived and never synced, so it has no table.

Migration `supabase/migrations/20261003150000_sync_flashcards_and_tombstones.sql`
adds the `flashcards` table (`profile_id, card_id` key; RLS and last-write-wins
triggers as for `library`) and a `deleted` tombstone column on `library`.
**Applied to the live project on 2026-10-03**, after which `supabase/tests/rls.sql`
(now also covering `flashcards` and tombstones) was re-run and passed.

- Primary keys are the client-generated ids (`attempts.id`, `profiles.id`) or
  the local composite key (`library`: `profile_id, arrangement_id`), so a push
  is idempotent (`TS-I-SYN-006`).
- Every table carries `owner_id uuid default auth.uid()` and has RLS enabled
  (`TA-SYN-005`). `anon` has no grant on any of them.
- **`attempts` is select + insert only** — no `UPDATE`/`DELETE` grant and no
  policy, so append-only (`TA-DAT-002`) is enforced by the database, not by
  convention. Deleting a profile still cascades.
- `profiles`, `library`, `settings` are last-write-wins on `updated_at_ms`:
  a `BEFORE UPDATE` trigger silently skips an older write rather than
  raising, so a stale outbox flush never errors or reverts a newer edit.
- Every table has a server-set `synced_at timestamptz`, bumped by trigger on
  each accepted write; `pull(since)` (`TA-PORT-002`) uses it as its cursor, so
  no client clock is trusted.
- Child rows (`attempts`, `library`, `settings`) are insert-checked to
  reference a profile with the same `owner_id`.
- `attempts.grade` and `attempts.events` are `jsonb` — `TA-DAT-002` embeds
  them — so a change to the grade shape needs no server migration.

Verified: anonymous `GET`/`POST` against all four tables is refused (401 /
`42501`). `TS-I-SYN-004` **passes** at the database level —
`supabase/tests/rls.sql` runs as two authenticated roles in a rolled-back
transaction (B sees none of A's rows and cannot write under A's profile; `attempts`
update/delete refused for the owner; stale write skipped, newer applied; anon
refused). It does not go through PostgREST/JWT.

The `SyncBackend` adapter (`SupabaseBackend`, `adapters/sync/`) and magic-link
sign-in (`US-2.02`, `SyncPanel` on the Studio screen) are built and selected when
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; otherwise
`FakeSyncBackend`. **Not yet verified:** a live end-to-end push/pull with a real
signed-in user. Deployment must add the site URL to Supabase's redirect allow-list,
and the built-in SMTP rate-limits magic-link emails.

---

## 10. Content pipeline

### TA-CNT-001 — Build-time, not runtime

Parsing MusicXML in the browser on a music stand is slow, failure-prone and
unnecessary when the catalogue changes once a month.

```
content/build/ingest.ts
  1. collect     content/sources/**.{musicxml,mxl,mid,json}
  2. parse       → notes, tempo map, key/time sig, part→hand mapping
  3. normalise   → 480 PPQ, absolute ticks, ties merged, grace notes resolved
  4. group       → assign groupId: notes within 30 ticks are one decision
  5. segment     → Sections on phrase boundaries, falling back to 2 bars
  6. analyse     → range, hand span, difficulty 1–5, tags
  7. licence     → join content/licences.json; FAIL THE BUILD if unmatched
  8. emit        → public/content/<pieceId>/<arrangementId>.v<n>.json + index.json
```

Delivered for US-2.07: stage 1 reads `content/sources/*.json` only (MusicXML/MIDI
parsing is unimplemented — all first-year child content is hand-authored JSON per
`TA-CNT-004`); stage 5 implements the fixed-bar fallback only (phrase-boundary
segmentation is unimplemented), 2 bars by default but configurable per source
(`SourceInput.barsPerQuest`, added for `US-3.09`'s Hanon generator, whose own
2/4-time notation needs 1-bar quest sections). Both are the documented
fallback paths, not a narrower design.

Delivered for US-3.09: stage 1 also calls `loadHanonSources()`, which maps
`HANON_PATTERNS` (`src/core/content/hanon.ts`) through a shared
`buildHanonSourceInput(pattern, options)` — the same `SourceInput`-building
logic `generateHanonArrangement` uses for the runtime (non-build) path, so a
Hanon drill is difficulty-scored and sectioned identically whether it was
baked into `public/content/` or generated live — and tags each with
`licenceId: 'hanon-virtuoso-pianist-1900'` (`TA-CNT-005`). `HANON_PATTERNS`
holds 5 of the eventual 20 entries: `hanon-01` is Hanon No. 1 itself;
`hanon-02`–`05` are original patterns in the same style, honestly labelled
`'Hanon-style Exercise N (approximate)'` rather than claimed as verified
transcriptions (`NFR-012`); 6–20 remain deferred, data-only additions.

Delivered for US-3.12: stage 1 also reads uncompressed `content/sources/*.musicxml`
(each paired with a `*.meta.json` sidecar carrying `id`/`tags`/`licenceId` — a bare
MusicXML file has no field for those), via `src/core/content/parseMusicXml.ts`.
Scope is bounded deliberately, matching `TA-CNT-005`'s fail-the-build philosophy —
anything past it throws a specific, actionable error rather than silently
mis-importing: a single `<part>` (solo piano only; four-hands duets stay
hand-authored JSON), up to two staves (treble/bass → `rh`/`lh` tracks), one voice
per staff (MusicXML's `<backup>`/`<forward>` multi-voice-per-staff interleaving is
not implemented), and a single global tempo/time/key signature taken from the
file's first `<attributes>`/`<sound>` (mid-piece changes are flattened). Ties are
merged (a `<tie type="stop">` extends the preceding same-pitch note's duration
rather than becoming a second onset — the one case in this scope that gets
resolved instead of rejected, since silently importing a tie as two onsets would
be a correctness bug, not a missing feature). No grace notes, unpitched
(percussion) notes, or double sharps/flats. `.mxl` (zip-compressed) and `.mid`
remain unimplemented this slice — only uncompressed `.musicxml` is read.

### TA-CNT-002 — Difficulty scoring

A transparent weighted sum over five axes, with sub-scores published in the JSON so
a mis-scored piece can be diagnosed rather than hand-overridden. Delivered for
US-2.08 as an **equal-weighted** average of five 1–5 bands, one per axis — the
initial weighting, not yet tuned against real content:

| Axis | Signal |
|---|---|
| Pitch range | Span in semitones, distance from middle C |
| Hand-position changes | How often the thumb must move |
| Rhythmic vocabulary | Shortest subdivision, ties across beats |
| Hand independence | Fraction of the piece where hands differ rhythmically |
| Accidental density | Accidentals per bar |

### TA-CNT-003 — Pedagogical mapping (ADR-008)

| Difficulty | Stage | Characteristics |
|---|---|---|
| 1 | Pre-staff five-finger, middle C | 5 notes, one hand position, quarter/half notes only |
| 2 | Neighbouring positions (D, G) | Position shifts between phrases, both hands separately |
| 3 | Landmark reading | Middle C / bass F / treble G anchors, simple hands-together |
| 4 | Grand staff | Full reading, eighth notes, basic accidentals |
| 5 | Early repertoire | Real pieces, position changes within phrases |

### TA-CNT-004 — Sources

| Source | Format | Yield |
|---|---|---|
| Hand-authored JSON | Own | Nearly all first-year child content. A five-finger tune is 20 notes. |
| Traditional / folk melodies | Author from memory | Public domain by age. Core of the child curriculum. |
| Hanon 1–20 | Generate | Each is one pattern sequenced up the scale. Generator delivered (`US-3.09`); 5 of 20 patterns authored so far — 1 verified, 2–5 approximate and labelled as such, 6–20 deferred |
| Mutopia Project | LilyPond → MusicXML | Adult module. Conversion imperfect; expect to fix articulations. Importer delivered (`US-3.12`, `TA-CNT-001`); no real Mutopia piece ingested through it yet. Separately, the project's solo keyboard **MIDI** files are mirrored as the song library (`US-3.19`, `TA-CNT-006`) — 576 pieces, each licence-gated |
| OpenScore | MuseScore / MusicXML | CC0 standard repertoire, cleanly engraved. Best MusicXML source. Importer delivered (`US-3.12`, `TA-CNT-001`); no real OpenScore piece ingested yet — acquiring and licensing one is a follow-up |
| Generated exercises | Runtime | Unlimited sight-reading at exactly the right difficulty. Delivered (`US-3.10`) — `/studio/sight-reading` calls `generateSightReadingArrangement` live and stores the result in `generatedContentStore`, never `content/sources/` |

### TA-CNT-005 — Licence gate

Every piece needs an entry in `content/licences.json` with a source URL and a
verification date. `ingest` exits non-zero without one. Costs nothing now; it is
the only thing that makes the catalogue safe to ever share. `LicenceEntry.status`
is `public-domain`, `cc0`, `cc-by`, `cc-by-sa` or `licensed`; the song library's
per-piece entries use the first, fourth and third.

### TA-CNT-006 — Chord & progression content

`US-3.13` (`FR-STU-012`). Chords and progressions across all 12 keys, for
the chord explorer. This content has no `Section`, no hand role, no
difficulty score, so it deliberately does **not** flow through
`TA-CNT-001`'s stages 4–6 (group/segment/analyse) and does not become a
`Piece`/`Arrangement` (`TA-DAT-001`):

```ts
interface ChordEntry {
  id: string;              // e.g. "C-maj7"
  root: PitchClass;        // 0–11
  quality: string;         // "maj", "min7", "dom7", ...
  midiNotes: MidiPitch[];  // one voicing
}
interface ProgressionEntry {
  id: string;
  name: string;            // "I-V-vi-IV"
  key: PitchClass;
  mode: 'major' | 'minor' | 'modal';
  moods: readonly string[]; // e.g. ["Hopeful", "Romantic"]
  chordIds: string[];      // in order
  suggestedBpm: number;
}
```

`content/build/ingestChords.ts` calls `generateChordCatalogue()`
(`src/core/content/chordCatalogue.ts`) and emits
`public/content/chords/index.json` — build-time only, same as every other
content (`ADR-003`, `TA-CNT-001`). The licence gate (`TA-CNT-005`) checks
three `content/licences.json` entries, since three distinct things are
sourced differently:

- **Chord voicings** (`midiNotes`, all 12 roots × 40 qualities = 480
  chords, plus the hand-authored 12-bar-blues turnaround) — generated from
  standard chord-interval formulas and diatonic harmony, public-domain music
  theory, not sourced from any corpus. The 40 qualities are the table in
  `chordQualities.ts` (triads, 7ths & 9ths, and an "Other" group of sus,
  add, 6th, altered and 5 chords); its chord *types* match the release's
  "All chords" folder, read as text from file names, and every formula was
  checked against that folder's MIDI. Licence entry:
  `duokeys-original-chord-catalogue`.
- **Progression sequences and mood tags** — ported as text data from
  [ldrolez/free-midi-chords](https://github.com/ldrolez/free-midi-chords)
  (MIT): the Major (50), Minor (58) and Modal (82, chromatic/borrowed
  degrees such as `bIII`, `#IV`) Roman-numeral token lists
  (`src/core/content/progressionData.ts`). Licence entry:
  `free-midi-chords-progressions`.
- **Rhythmic style MIDI** — the release's pop, pop2, soul and hiphop2 style
  files, 760 of them (the reference key of each set: C for Major and Modal,
  A for Minor), committed unmodified under `content/chord-styles/` with the
  MIT notice and copied to `public/content/chords/styles/` by the ingest.
  The other keys in the release are the same files shifted, so the app
  transposes. Licence entry: `free-midi-chords-style-midi`.

Chord pitches are never read from the MIDI: each ported token (e.g. `"IV"`,
`"iim7"`, `"bIIIM"`, `"IM-5"`) is parsed (`parseDegreeToken` in
`chordCatalogue.ts`) into a scale degree, an optional `b`/`#` accidental
and a chord quality, then transposed into all 12 keys — the same
interval-formula engine that generates every chord's `midiNotes`. A bare
`7` or a lower-case numeral on the diminished degree is read diatonically
(the release's convention, confirmed against its MIDI), but only when the
token has no accidental. Modal degrees count off the major scale. Where the
release lists identical chords under two moods, the repeat keeps its own
entry with the id suffixed `~2`.

The generated catalogue covers 480 chords and, per key, 1 hand-authored
12-bar-blues turnaround + 50 major + 58 minor + 82 modal progressions (191
per key, 2,292 progressions across the 12 keys) — `generateChordCatalogue()`
is fully deterministic and pure (`ADR-005`). `ProgressionEntry.mode` is
`'major' | 'minor' | 'modal'`.

**Standard MIDI File reader.** `src/core/midi/smf.ts` (`parseSmf`) is a pure
`.mid` reader: bytes in, notes (start and length in ticks, velocity,
channel), tempo changes, time signature and track names out. It handles
running status, velocity-0 note-offs and unclosed notes, skips what it does
not need, and returns an error value rather than throwing on a malformed or
SMPTE-timed file. `decode.ts` still only decodes live Web MIDI messages; the
two do not share code. Callers pass bytes in, so `core/` never touches the
file system or network (`ADR-005`).

**Extension — `US-3.18` (`FR-STU-015`).** The shipped catalogue is unchanged
by this extension (a test asserts its counts). Three additions sit beside it:

- **User progressions.** `chordSymbols.ts` parses typed chord symbols or
  Roman numerals into chords (qualities extended with dom9/min9/maj9/dim7/
  min7b5); `userProgression.ts` wraps a parsed list as a `UserProgression`,
  stored in the profile's `settings` record (`TA-DAT-003`, field
  `userProgressions`) and merged into the explorer's catalogue as
  `ProgressionEntry` rows flagged `isUserAdded`. Sync treats `settings.data`
  as opaque JSON, so no migration or new table is needed.
- **Falling-notes play.** `progressionArrangement.ts` converts any
  progression into an in-memory `Arrangement` (id `chords:<progressionId>`,
  one `'chords'` track, four beats per chord at 480 PPQ, chord notes sharing a
  group id so `TA-MAT-002` treats them as one chord, `chordMarkers` for the
  symbols) and plays it through `sessionStore.startArrangement` in wait mode
  and `TA-REN-001`. This is a deliberate exception to the "does not become an
  `Arrangement`" line above: it is generated at play time, never stored as
  content, and attempts record the synthetic id (append-only, `TA-DAT-002`).
- **Rhythmic styles.** `styledProgression.ts` builds the same kind of
  `Arrangement` from one of the four bundled style files (`parseSmf`): pitches
  shifted by the key distance (folded to −6…+5), the file's own tempo, time
  signature and bar-aligned loop (two passes), simultaneous notes sharing a
  group id. Chord markers come from the file, not a fixed bar: the loop is
  split evenly across the chords, with a half beat of anticipation allowed.
  Checked against the release, every file segments cleanly except at most 23 per
  style whose progressions already differ upstream. `staticChords.ts` fetches
  the file; the play page offers "Block chords" (the default, and the
  fallback if a file fails to load) and the four styles. The 12-bar blues has
  no style file.

**Extension — `US-3.19` (`FR-STU-016`), the song library.** Real pieces as
MIDI, searched in-app and played as falling notes. Four additions:

- **Build-time mirror.** Mutopia serves no CORS headers, so a runtime search
  of the site from the browser is impossible, and a proxy would need a server
  (`ADR-002`). `content/build/crawlMutopia.ts` lists the piano pieces (the
  listing pages hold ten each) into `content/sources/mutopia/index.json`;
  `fetchMutopiaMidi.ts` downloads the solo keyboard ones (`isSoloKeyboard`:
  piano, harpsichord, clavichord — no duets, voice or strings) into
  `content/sources/mutopia/mid/`. Both are run by hand and committed.
- **Ingest.** `content/build/ingestSongs.ts` (part of `content:build`,
  or `content:build:songs`) asserts a licence entry for every piece
  (`TA-CNT-005`; `--write-licences` adds the missing ones from the crawl),
  checks each file parses and yields notes, copies the files to
  `public/content/songs/mid/<id>.mid` and writes `public/content/songs/index.json`.
- **Pure half.** `songLibrary.ts` holds `SongEntry`, `searchSongs` (every word
  matches title, composer, opus or style, accent- and punctuation-blind),
  `stylesOf`, and `smfToArrangement`: `parseSmf` output scaled from the file's
  ticks per quarter to 480 PPQ, tracks `both` / `rh` / `lh` (two note tracks
  read as right then left; one track split at middle C), notes that begin
  together sharing a group id, the file's tempo changes, and one section.
  `isMonophonic` tells the play page whether the notation view could draw it.
- **Shell.** `adapters/content/staticSongs.ts` fetches the index and the bytes
  (same shape as `staticChords.ts`; not a port method, for the same reason).
  `runtime/stores/songLibraryStore.ts` keeps "my songs" as `savedSongIds` on the
  profile's `settings` record (`TA-DAT-003`) — no new table, syncs as opaque
  JSON, the MIDI itself is never stored. `/studio/library` searches and adds;
  `/studio/play/mutopia-<n>` parses and converts on load and plays through
  `sessionStore.startArrangement`. The `both` track is never accompaniment, and
  practising it leaves no other track to accompany.

A converted piece is generated at play time and never stored as content;
attempts record the synthetic id `mutopia-<n>`. `core/` still touches no file
system or network: bytes come in through the adapter.

### TA-CNT-007 — Custom songs and free play

`US-3.22` (`FR-STU-017`–`019`). Pure `core/content/customSong.ts` (chart parser, `custom:` ids, chart / MIDI / MusicXML to Arrangement) and `core/content/freePlay.ts` (easy-progression filter and a seeded-random picker); `runtime/stores/customSongStore.ts` keeps songs in the profile's `settings.customSongs` (so they sync with no table; MIDI bytes as base64, 400 KB cap); a file is built into an arrangement before it is saved and refused if it does not play, and a MusicXML piece whose bar count is odd falls back to one-bar sections. <code>runtime/stores/learnStore.ts</code> keeps the Learn page's ticked steps in <code>settings.learnDone</code> (<code>FR-STU-019</code>). `profileStore` now remembers the active profile id in localStorage (a per-device convenience, never synced) so a direct page load sees that profile's songs, and the profile picker refreshes after a sync round (`syncStore.syncRound`).

---

## 11. Application shell

### TA-APP-001 — Stack

| Concern | Choice | Constraint |
|---|---|---|
| Framework | Next.js (App Router) | `output: 'export'` compatible — ADR-002 |
| Language | TypeScript, `strict` | `noUncheckedIndexedAccess` on |
| State | Zustand for session state; React Query not needed (no server) | |
| Styling | CSS custom-property design tokens + CSS Modules per component (`TA-APP-006`) | |
| Audio | Tone.js | |
| Notation | OpenSheetMusicDisplay (BSD-3) | Studio routes only |
| Storage | `idb` | |
| Sync | `@supabase/supabase-js` | |
| Test | Vitest + Playwright | |
| Host | Vercel Hobby | Non-commercial only — fine for family use |

### TA-APP-002 — Composition root

`runtime/bootstrap.ts` is the only file that constructs adapters and injects them
into core. Swapping `WebMidiBackend` for `CoreMidiBackend` is a one-line change
here — that is the whole of ADR-002's cost.

### TA-APP-003 — Routes

```
/                             profile picker
/explorer                     child home — quest map
/explorer/[arrangementId]     per-piece quest map
/explorer/play/[id]           falling-notes practice
/explorer/[arrangementId]/session   session arc — warm-up, quests, wind-down (TA-APP-005)
/explorer/ninja                Note Ninja
/explorer/free-play            ungraded free play (FR-EXP-006)
/studio                       adult home — three tracks (FR-STU-017–019)
/studio/practice/[id]         OSMD + matcher
/studio/drills                Hanon / sight-reading generators
/studio/chords                 chord & progression explorer + my progressions (TA-CNT-006, TA-MAT-007)
/studio/chords/play/[progressionId]  a progression as falling notes (FR-STU-015); ?style= preselects the rhythm
/studio/learn                 track 1 — roadmap and slow Hanon drills (FR-STU-019)
/studio/free-play             track 2 — "play something for me" (FR-STU-018)
/studio/songs                 track 3 — my songs, add a song, library (FR-STU-017)
/studio/songs/[id]             lead-sheet song mode (FR-STU-013)
/studio/library                 song library — search, add to my songs (FR-STU-016, TA-CNT-006)
/studio/play/[id]              also plays library songs, id mutopia-<n> (FR-STU-016)
/duet/[id]                    four-hands mode
/dashboard                    practice history
/settings                     profiles, MIDI device, calibration, sync
```

### TA-APP-004 — PWA

Service worker precaches the app shell and all content JSON. Wake lock during
active sessions. Installable. Offline is the default assumption, not a fallback.

### TA-APP-005 — Session arc

`US-2.17`. A practice session is a short arc, not a bare quest map: free play
(warm-up) → up to three quests → free play (wind-down). `buildSessionArc`
(`core/session/arc.ts`, pure, `ADR-005` — random source injected) reads
`computeProgression`'s (`TA-DAT`) output for the arrangement and picks up to
three *unlocked* sections, preferring ones not yet attempted or with fewer than
two stars — what's worth practicing today — and wraps them with a free-play
step at each end.

The arc does not own a parallel practice flow. `sessionArcStore` (Zustand,
`TA-APP-001`) only sequences existing routes: a free-play step mounts the same
`FreePlay` component used at `/explorer/free-play`; a quest step links into the
existing `/explorer/play/[id]?section=X`. When a quest is reached *via* the arc
(`sessionArcStore.active`), its complete-state screen shows a "Continue your
session" button that advances the arc and returns to
`/explorer/[arrangementId]/session`; reached directly, that button does not
appear — the arc is strictly opt-in orchestration, never a required path.

### TA-APP-006 — Visual design system

`US-3.16`, `US-3.17`. Resolves `TA-APP-001`'s "either, chosen once" — the
product ships one deliberate visual identity, defined once as tokens and
consumed everywhere, rather than per-screen styling decisions. Reference:
the **DuoKeys Design Reference** artifact (CLAUDE.md § 1.5) — eight annotated
screen mockups plus the logo lockups; this section is the code-facing summary
of what that artifact specifies.

- **Tokens as CSS custom properties**, one shared stylesheet
  (`src/ui/shared/tokens.css`), consumed by CSS Modules per component — never
  a per-component hard-coded hex or `px` value for anything the token system
  already names.
  - **Palette:** a light paper ground (`--app-paper`) and ink
    (`--app-ink`/`--app-ink-soft`/`--app-ink-faint`), plus three role hues —
    amber for Explorer/child surfaces, indigo for Studio/adult surfaces,
    coral reserved exclusively for shared "both players" moments (duet
    screens). A hue is never repurposed outside its role — coral appearing
    on a single-player screen would be a bug, not a style choice.
  - **Type:** Bricolage Grotesque (display/headings), Plus Jakarta Sans
    (UI/body), IBM Plex Mono (numbers — tempo %, rush/drag ms, star counts,
    anything tabular), self-hosted via `next/font/local` from `@fontsource` packages — a build never needs Google Fonts.
  - **Shared components:** an on-screen keybed (one component, recoloured by
    role token — amber in Explorer, indigo in Studio, split amber/indigo in
    Duet) and a chord/card primitive reused by the quest map, the library
    list and the chord-progression view.
- **The product commits to one theme, deliberately** — light only, no
  dark-mode toggle. This is a product decision (`NFR-008`, `PRE-*` "kid-
  friendly but not childish, and still a credible adult tool" brief), not an
  oversight: unlike a general-purpose document or tool, DuoKeys' palette
  carries meaning (role colour, reward states) that a naive dark inversion
  would undermine. Revisit only via a new ADR if this stops serving the
  product.
- **Retrofit, not just new screens.** `US-3.16` builds the token system and
  shared components; `US-3.17` applies them to the Explorer surfaces already
  shipped in Sprints 1–2 (quest map, falling notes, Note Ninja), so the whole
  app matches the reference, not only the Studio screens built after it
  existed.
- **Role shell and picture cards (`US-3.21`).** `PageShell` is the one place
  that carries the identity onto every route: the logo lockup (`Logo.tsx`,
  the split-keybed mark), a role pill, and a soft wash of the role colour taken
  from the route (`/explorer` amber, `/studio` indigo, everything else coral),
  exposed to children as `--role`, `--role-deep` and `--role-tint`. `ActionCard`
  is the picture-tile link used on the Explorer and Studio homes; the picture
  and the title both say what it is, so colour is never the only cue. The mark
  is also the favicon (`src/app/icon.svg`).
- **Play-screen kit (`US-3.21`, second pass).** The remaining screens reuse four
  shared pieces instead of per-page styling: `MidiChooser` (picture tile, one big
  button per piano, a connection line in words and a dot), `Segmented` (radio
  groups drawn as pills; the chosen one carries a tick as well as the fill),
  `Pill` (streak / status), and `Stage.module.css` (the big-note card, band
  pills, mode choices). The Explorer quest map is a winding path of numbered
  stops (done filled, current ringed and labelled "Start here", locked grey
  with a padlock and the word "Locked", stars as emoji with an aria-label).
  `globals.css` gives every input, select and range one look (44 px, 16 px text,
  role-coloured controls and focus ring). No behaviour changed: Wait mode,
  hints and the no-failure rule are untouched.
- **Studio screens that need no piano (`US-3.21`).** The song library is a list
  of picture-led rows (composer initial tile, title, style / instrument / bars as
  pills, licence and source links kept, Play and Add / Remove). The chord explorer
  uses `Segmented` for key, mode and numeral choices, pill tabs with a tick on the
  open one, progression rows on tokens (no hard-coded colours), and indigo only:
  coral is kept for shared / duet moments. The backup panel got a tile and the
  shared input look; its calm-offline wording (`FR-SYN-005`) is unchanged. The
  song page and the chord-progression page use `MidiChooser`, `Segmented` and the
  star result card. No behaviour changed.
- **The last plain screens and parts (`US-3.21`).** Loading and "could not load"
  messages use one `StatusNote` (a picture tile and a short line) instead of bare
  text. A branded not-found page (`app/not-found.tsx`) leads back to the profile
  picker. The chord keybed (`ChordKeybed`) is drawn on the tokens, and a key to
  play carries a dot and a played key a tick, so colour is not the only cue
  (`NFR-008`). The falling-notes canvas (`TA-REN-001`) scales to the screen width
  (it was a fixed 960 px), sits on a framed surface, takes its colours from the
  role tokens, and outlines the note it is waiting for. Studio's own pieces are
  list rows (`ListRow.module.css`, shared with the song library), and their
  repertoire status is a row of 44 px toggle pills with a tick and `aria-pressed`.
  The Studio play screen has a framed Loop group, a pill view switch, a tempo
  readout and the star result card. Sight-reading shares those controls
  (`Controls.module.css`). The chord explorer's last inline styles moved to its
  stylesheet: a piano status pill, a framed now-playing card with the chord name
  large, card headings, and your own progressions drawn as the same rows as the
  catalogue. No behaviour changed. The notation view keeps its green / red / grey
  correct / wrong / missed colours, because those are feedback, not brand.

---

## 12. Non-functional requirements

| ID | Requirement | Target | Rationale |
|---|---|---|---|
| `NFR-001` | Input→visual latency | < 30 ms p95 | Above this the keybed feels detached from the hands |
| `NFR-002` | Frame rate during falling notes | 60 fps, no frame > 32 ms | A dropped frame reads as a timing error |
| `NFR-003` | Input→app-audio latency | < 60 ms p95 | Relaxed by TA-AUD-001 — instrument makes its own sound |
| `NFR-004` | Cold start to playable | < 3 s | The gap between "sit down" and "play" is where habits die |
| `NFR-005` | Offline capability | 100% of practice features | ADR-003 |
| `NFR-006` | JS bundle, Explorer route | < 200 KB gz | OSMD must never load on the child's path |
| `NFR-007` | Session data loss on crash | 0 attempts | Flush to IndexedDB per section, not per session |
| `NFR-008` | Colour is never the only signal | — | Note state needs shape or position too |
| `NFR-009` | Touch targets | ≥ 44 px | And nothing important where a small hand rests |
| `NFR-010` | Privacy | First names only, no child email, no analytics, no audio leaves device | Keeps COPPA/GDPR-K out of scope |
| `NFR-011` | `prefers-reduced-motion` | Honoured | Falling notes stay; particle celebrations do not |
| `NFR-012` | No dark patterns | — | No streak-loss anxiety, no artificial scarcity |

---

## 13. Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| `RISK-001` | Latency feels wrong even after calibration | Medium | Critical | **Resolved, Sprint 0.** Measured median 45.9 ms, IQR 16.5 ms — go. See `docs/sprint-0-findings.md` |
| `RISK-002` | Child loses interest in weeks | Medium | High | Sprint 2 exit is a week of unsupervised real use; expect to discard a designed feature |
| `RISK-003` | Web MIDI device enumeration flaky on Windows | Low | Medium | Detected in Sprint 0; `MidiBackend` isolates any workaround |
| `RISK-004` | MusicXML conversion quality poor | Medium | Low | Hand-authored JSON is the primary child source anyway |
| `RISK-005` | Scope creep from adult module | High | Medium | Sprint 3 is gated on Sprint 2 exit criteria being met first. **Deviation, by explicit user decision, before the Sprint 2 observation week completed:** a deliberately minimal Studio slice (`US-3.01`/`3.02`/`3.03`/`3.05`) plus the shared design system (`US-3.16`/`3.17`) shipped early, so both journeys could be tested at the piano together. Scoped down specifically to keep this risk's actual danger — unbounded scope creep — from materialising: the other 11 Sprint 3 stories (57 pts) stay unbuilt. |
| `RISK-006` | Supabase project paused during a holiday | High | Low | ADR-003 makes this a degraded-sync, not an outage |
| `RISK-007` | iPad path silently closes through a stray import | Medium | Medium | `TA-PORT-005` lint rule fails CI |
| `RISK-008` | No Mac available when Sprint 5 arrives | High | Medium | Decide rented vs. cloud Mac before starting Sprint 5, not during |

---

## Traceability

See [00-INDEX.md](00-INDEX.md) for the full matrix mapping `TA-*` → `FR-*` → `US-*` → `TS-*`.
