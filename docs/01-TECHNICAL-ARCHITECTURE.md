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
  constructor(private audio: AudioBackend, private tempoMap: TempoMap) {}

  nowAudio(): Seconds;
  wallToAudio(t: Millis): Seconds;   // EMA-corrected, see TA-CLK-003
  audioToTicks(t: Seconds): Ticks;
  ticksToAudio(t: Ticks): Seconds;

  start(atTick: Ticks): void;
  pause(): void;
  setTempoScale(scale: number): void;  // 0.30 – 1.00, see FR-STU-004
}
```

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

### TA-REN-002 — Pitch→x mapping

Worth isolating and unit-testing (`TS-U-REN-*`): white keys tile uniformly, black
keys are inset and overlap, the pattern repeats every octave with 2–3 grouping.
Derived once from `Profile.keyboardRange`.

### TA-REN-003 — Notation (OpenSheetMusicDisplay)

Studio mode only. OSMD is BSD-3-Clause. Matcher-driven cursor; per-note colouring
applied after an attempt, not during (repainting the SVG mid-performance is the
fastest way to drop frames).

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
| `settings`, `profiles` | Last-write-wins on `updatedAt` | Changed rarely, by one adult, on one device at a time |
| `progression` | Recomputed from attempts | Derived state — never synced directly |

This is deliberately the boring choice. There is no CRDT, no vector clock, and no
merge UI, because the data model was shaped to make them unnecessary.

### TA-SYN-004 — Outbox

Every local write that needs syncing appends an op. A background flush drains it
when online and authenticated. Failure is silent and retried; sync never blocks or
interrupts a practice session.

### TA-SYN-005 — Row-level security

Every Supabase table has RLS enabled with `auth.uid() = owner_id`. No exceptions,
verified by `TS-I-SYN-004`.

### TA-SYN-006 — Free-tier pause mitigation

Supabase pauses a free project after 7 days without API traffic. Because sync is
never on the read path (ADR-003), a paused project degrades to "sync is behind",
not "the app is down". A weekly scheduled ping is optional insurance, not a
requirement.

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

### TA-CNT-002 — Difficulty scoring

A transparent weighted sum over five axes, with sub-scores published in the JSON so
a mis-scored piece can be diagnosed rather than hand-overridden:

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
| Hanon 1–20 | Generate | Each is one pattern sequenced up the scale — write the generator |
| Mutopia Project | LilyPond → MusicXML | Adult module. Conversion imperfect; expect to fix articulations |
| OpenScore | MuseScore / MusicXML | CC0 standard repertoire, cleanly engraved. Best MusicXML source |
| Generated exercises | Runtime | Unlimited sight-reading at exactly the right difficulty |

### TA-CNT-005 — Licence gate

Every piece needs an entry in `content/licences.json` with a source URL and a
verification date. `ingest` exits non-zero without one. Costs nothing now; it is
the only thing that makes the catalogue safe to ever share.

---

## 11. Application shell

### TA-APP-001 — Stack

| Concern | Choice | Constraint |
|---|---|---|
| Framework | Next.js (App Router) | `output: 'export'` compatible — ADR-002 |
| Language | TypeScript, `strict` | `noUncheckedIndexedAccess` on |
| State | Zustand for session state; React Query not needed (no server) | |
| Styling | CSS Modules or Tailwind — either, chosen once | |
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
/                     profile picker
/explorer             child home — quest map
/explorer/play/[id]   falling-notes practice
/explorer/ninja       Note Ninja
/studio               adult home
/studio/practice/[id] OSMD + matcher
/studio/drills        Hanon / sight-reading generators
/duet/[id]            four-hands mode
/dashboard            practice history
/settings             profiles, MIDI device, calibration, sync
```

### TA-APP-004 — PWA

Service worker precaches the app shell and all content JSON. Wake lock during
active sessions. Installable. Offline is the default assumption, not a fallback.

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
| `RISK-005` | Scope creep from adult module | High | Medium | Sprint 3 is gated on Sprint 2 exit criteria being met first |
| `RISK-006` | Supabase project paused during a holiday | High | Low | ADR-003 makes this a degraded-sync, not an outage |
| `RISK-007` | iPad path silently closes through a stray import | Medium | Medium | `TA-PORT-005` lint rule fails CI |
| `RISK-008` | No Mac available when Sprint 5 arrives | High | Medium | Decide rented vs. cloud Mac before starting Sprint 5, not during |

---

## Traceability

See [00-INDEX.md](00-INDEX.md) for the full matrix mapping `TA-*` → `FR-*` → `US-*` → `TS-*`.
