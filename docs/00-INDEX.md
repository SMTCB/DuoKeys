# DuoKeys — Documentation Index

**Version:** 1.0 · **Date:** 2 September 2026 · **Status:** Baselined, ready to build

A local-first web app that connects to a digital piano over USB MIDI and teaches
a six-year-old and an adult beginner to play — separately, and together.

---

## The document set

| # | Document | ID | Contains |
|---|---|---|---|
| 01 | [Technical Architecture](01-TECHNICAL-ARCHITECTURE.md) | `TECH` | 9 ADRs, ports & adapters, clock, MIDI pipeline, matcher, grading, renderers, data model, sync, content pipeline, 12 NFRs, 8 risks |
| 02 | [Functional Specification](02-FUNCTIONAL-SPECIFICATION.md) | `FUNC` | 52 requirements across 7 modules (4 proposed, unscheduled), prioritised MoSCoW |
| 03 | [Sprint Plan & User Stories](03-SPRINT-PLAN.md) | `SPRINT` | 6 sprints, 72 user stories, each mapped to FR and TA IDs |
| 04 | [Test Scenarios](04-TEST-SCENARIOS.md) | `TEST` | ~130 scenarios across 5 tiers, with a coverage matrix |
| 05 | [Engineering Handbook](05-ENGINEERING-HANDBOOK.md) | `ENG` | Pre-build checklist, repo scaffold, Definition of Done, conventions, content authoring guide, Sprint 0 kit |

**Rendered as HTML:** documents 01–03 also exist as a navigable, cross-linked set
in [`docs/html/`](html/index.html) — open `docs/html/index.html` from disk, no
server needed. The Markdown is the source; the HTML is a rendering of it, and
`node scripts/docs-check.mjs` fails if the two drift.

**Ground rules:** `CLAUDE.md` at the repo root. It carries the architecture rules,
the product rules, and the documentation impact matrix — which files each kind of
change obliges you to update.

**Superseded:** `DuoKeys_Project_Specification.html` (original brief) and
`DuoKeys_Architecture.html` (the review that produced these). Both are retained as
the record of how the decisions were reached; this set is now authoritative.

---

## ID scheme

Every artefact has a stable ID so that a change anywhere can be traced everywhere.

```
ADR-nnn      architecture decision        TECH § 0
TA-XXX-nnn   technical component          TECH § 1–11
NFR-nnn      non-functional requirement   TECH § 12
RISK-nnn     risk                         TECH § 13
FR-XXX-nnn   functional requirement       FUNC
US-s.nn      user story (s = sprint)      SPRINT
TS-X-XXX-nnn test scenario                TEST
PRE-nnn      pre-build activity           ENG § 1
```

**Direction of reference:** `TS-*` → `US-*` → `FR-*` → `TA-*` → `ADR-*`.
Tests cite stories, stories cite requirements, requirements cite components,
components cite decisions. Never the other way round.

---

## The nine decisions everything rests on

| ADR | Decision |
|---|---|
| `ADR-001` | **Desktop browser, not iPad.** Web MIDI is not implemented in any WebKit browser — WebKit bug #107250, open since 2013. Native CoreMIDI is a different thing entirely, which is why iPad MIDI apps exist. |
| `ADR-002` | **Keep the iPad door open for free.** All MIDI through one port, no server-only Next.js features. Extension is a Capacitor shell plus a Swift plugin. Needs a Mac. |
| `ADR-003` | **Local-first.** IndexedDB is truth. Every practice feature works offline. |
| `ADR-004` | **Sync in Sprint 2, not deferred.** A lost laptop must not cost a year of progress. |
| `ADR-005` | **Pure core, thin adapters.** ~80% of the risk becomes testable with no hardware. |
| `ADR-006` | **Audio clock is master.** Grade against what the player hears. |
| `ADR-007` | **Tempo-relative tolerance with a floor.** A flat ±150 ms is wrong at both 60 and 160 bpm. |
| `ADR-008` | **Follow mainstream beginner pedagogy.** Faber/Alfred/Bastien agree on a four-stage order; use it. |
| `ADR-009` | **88 keys, sustain pedal, class-compliant USB.** |

---

## Traceability matrix

Reading down: what each functional requirement is built from and verified by.

| FR | Pri | Realised by | Delivered in | Verified by |
|---|---|---|---|---|
| FR-EXP-001 quest map | M | TA-APP-003, TA-DAT-001 | US-2.10 | TS-E-003 |
| FR-EXP-002 falling notes | M | TA-REN-001/002 | US-1.10 | TS-U-REN-001…006, TS-M-004 |
| FR-EXP-003 wait mode | M | TA-MAT-002 | US-1.11 | TS-U-MAT-001…008, TS-M-005 |
| FR-EXP-004 micro-quests | M | TA-DAT-001 | US-2.11 | TS-U-CNT-007, TS-U-CNT-016, 017, TS-E-003 |
| FR-EXP-005 Note Ninja | S | TA-DAT-003, TA-DAT-006, TA-GRD-005 | US-2.13, US-2.14 | TS-U-GRD-013, 014, TS-E-006, TS-E-007 |
| FR-EXP-006 free play | S | TA-AUD-001 | US-2.19 | TS-M-006 |
| FR-EXP-007 generous grading | M | TA-GRD-002, TA-MAT-003, TA-MAT-006 | US-1.13, US-2.15, US-2.16 | TS-U-GRD-001…005, TS-U-GRD-015, TS-U-MAT-010…018, TS-U-MAT-022 |
| FR-EXP-008 rewards | S | TA-APP-005, TA-AUD-001, NFR-011 | US-2.17, US-2.18 | TS-E-013 |
| FR-STU-001 notation | M | TA-REN-003 | US-3.01 (delivered early — see `RISK-005`) | TS-M-010, TS-U-REN-008…010 |
| FR-STU-002 note colouring | M | TA-REN-003, TA-GRD-001 | US-3.03 (delivered early — see `RISK-005`) | TS-M-010 |
| FR-STU-003 A/B loop | M | TA-CLK-002 | US-3.04 | TS-U-CLK-011…014, TS-E-010 |
| FR-STU-004 tempo + auto-ramp | M | TA-CLK-002 | US-3.05 (delivered early — see `RISK-005`), US-3.06 | TS-U-CLK-003, TS-E-011 |
| FR-STU-005 hands separate | M | TA-AUD-002 | US-3.07 | TS-M-009 |
| FR-STU-006 articulation | S | TA-MID-004, TA-GRD-006 | US-1.09, US-3.08 | TS-U-PED-001…006, TS-U-GRD-020, 021 |
| FR-STU-007 Hanon evenness | S | TA-GRD-003, TA-CNT-004 | US-3.09 | TS-U-GRD-008/009, TS-U-CNT-020, TS-G-007/008 |
| FR-STU-008 rush/drag | M | TA-GRD-001 | US-3.11 | TS-U-GRD-006, 007, 018, 019 |
| FR-STU-009 per-measure | S | TA-GRD-004 | US-4.06 | TS-U-GRD-010 |
| FR-STU-010 sight-reading gen | S | TA-CNT-004 | US-3.10 | TS-U-CNT-021, TS-M-009 |
| FR-STU-011 repertoire ingest | C | TA-CNT-001 | US-3.12 | TS-U-CNT-001…004 |
| FR-STU-012 chord & progression explorer | M | TA-CNT-006, TA-MAT-007 | US-3.13 | TS-U-MAT-023…025, TS-U-CNT-019 |
| FR-STU-013 lead-sheet song mode | M | TA-DAT-001 (ext), TA-REN-001 | US-3.14 | TS-U-REN-007 |
| FR-STU-014 personal score import | C | — (future roadmap) | — | — |
| FR-STU-015 my progressions & falling-notes chords | S | TA-CNT-006, TA-REN-001, TA-DAT-003 | US-3.18, US-3.20 | TS-U-CNT-022…027, TS-I-DAT-008, TS-M-016 |
| FR-STU-016 song library | S | TA-CNT-004, TA-CNT-005, TA-CNT-006, TA-REN-001, TA-DAT-003 | US-3.19 | TS-U-CNT-028, 029, TS-I-DAT-009, TS-M-015 |
| FR-STU-017 custom songs | S | TA-CNT-007, TA-APP-003, TA-DAT-003 | US-3.22 | TS-U-CNT-030…035, TS-I-DAT-010, TS-M-017 |
| FR-STU-018 free play | S | TA-CNT-007, TA-CNT-006, TA-APP-003 | US-3.22 | TS-U-CNT-036…041, TS-M-017 |
| FR-STU-019 learn roadmap | S | TA-APP-003, TA-CNT-007, TA-DAT-003 | US-3.22 | TS-I-DAT-011 |
| FR-DUO-001 split + transpose | M | TA-DAT-001 | US-4.01 | TS-E-015, TS-M-012 |
| FR-DUO-002 dual matchers | M | TA-MAT-001 | US-4.02 | TS-U-MAT-021, TS-G-010 |
| FR-DUO-003 asymmetric parts | M | TA-DAT-001 | US-4.03 | TS-M-011 |
| FR-DUO-004 shared result | S | TA-GRD-001 | US-4.04 | TS-M-011 |
| FR-PRO-001 profiles | M | TA-DAT-004 | US-2.01 | TS-U-DAT-001, 002, TS-I-DAT-006, TS-E-005 |
| FR-PRO-002 progression | M | TA-DAT-003 | US-2.12 | TS-U-PRO-001…005, TS-I-DAT-004, TS-E-004 |
| FR-PRO-003 history | M | TA-DAT-002 | US-1.14 | TS-I-DAT-001, 002 |
| FR-PRO-004 dashboard | S | TA-GRD-004, TA-SYN-001 | US-4.06, US-4.07 | TS-U-GRD-010 |
| FR-PRO-005 recording | C | TA-DAT-002 | US-4.05 | — |
| FR-PRO-006 saved repertoire | M | TA-DAT-007 | US-3.15 | TS-U-DAT-003, TS-I-DAT-007, TS-I-SYN-011 |
| FR-CON-001 static content | M | TA-DAT-005, TA-CNT-001 | US-2.07 | TS-U-CNT-001…004, 018 |
| FR-CON-002 beginner catalogue | M | TA-CNT-003 | US-2.09 | TS-U-CNT-012, TS-M-006 |
| FR-CON-003 segmentation | M | TA-CNT-001 | US-2.07 | TS-U-CNT-007, 008 |
| FR-CON-004 licence gate | M | TA-CNT-005 | US-2.08 | TS-U-CNT-009, 010 |
| FR-SYN-001 auth | M | TA-SYN-002 | US-1.03, US-2.02 (built) | TS-I-SYN-004 (DB-level, passes) |
| FR-SYN-002 background sync | M | TA-SYN-001/004/007 | US-2.03 (built) | TS-I-SYN-001…003 (pass), 009 |
| FR-SYN-003 device restore | M | TA-SYN-001/007 | US-2.04 (built) | TS-I-SYN-005 (pass), TS-E-009 |
| FR-SYN-004 sync status | S | TA-SYN-004 | US-4.11 | — |
| FR-SYN-005 offline normal | M | ADR-003 | US-2.06 | TS-E-008, TS-I-SYN-010 |
| FR-SYS-001 device select | M | TA-PORT-003 | US-0.01, US-1.07 | TS-I-MID-001, 002 |
| FR-SYS-002 calibration | M | TA-CLK-004 | US-0.04, US-1.06 | TS-U-CLK-007/008, TS-M-001 |
| FR-SYS-003 first run | M | — | US-1.06, US-2.01 | TS-E-001 |
| FR-SYS-004 disconnect | M | TA-MID-005 | US-4.09 | TS-I-MID-003/004, TS-M-013 |
| FR-SYS-005 unsupported browser | M | — | US-4.10 | TS-I-MID-005 |
| FR-SYS-006 PWA | S | TA-APP-004 | US-4.08 | — |
| FR-SYS-007 accessibility | M | NFR-008/009/011 | ongoing | TS-E-013, TS-E-014 |
| FR-SYS-008 privacy | M | NFR-010 | US-2.05 | TS-I-SYN-004 |

---

## Build sequence at a glance

| Sprint | Focus | Duration | Gate to pass before moving on |
|---|---|---|---|
| **0** | Hardware spike | 1–2 days | **Go/no-go.** Real latency measured, under ~80 ms after calibration |
| **1** | Walking skeleton | ~1 week | A child plays 8 bars in wait mode and sees stars |
| **2** | The child's loop | ~2 weeks | A week of daily unsupervised use — and one designed feature discarded |
| **3** | The adult's loop | ~2 weeks | You prefer it to your current practice method for a week |
| **4** | Duet & dashboard | ~2 weeks | Four hands together, both results fair. **v1 delivered** |
| **5** | iPad *(optional)* | ~1 week | Requires a Mac — arrange before starting |

**~7 weeks to v1** at part-time evening pace.

---

## Still open

Neither blocks Sprint 0.

1. **Headphones or the instrument's own speakers?** (`PRE-008`) Assumed: the
   instrument's speakers. Headphones would move app audio onto the critical path
   and make `NFR-003` much more demanding.
2. **Ever shared beyond the family?** Assumed no. Yes would turn licensing rigour,
   privacy posture and Vercel's non-commercial Hobby terms into requirements
   rather than footnotes.

---

## Sprint 1 — deferred manual verification

Sprint 1's code (the walking skeleton) is complete and green — typecheck,
lint, boundary lint, unit tests, `docs-check`, and a production build all
pass. Four items need the physical instrument and are bookmarked here rather
than treated as done, since access to the piano wasn't available when the
code was finished:

1. **`TS-M-005`** — a child completes 8 bars in wait mode, unassisted. This is
   Sprint 1's actual exit criterion (`docs/03-SPRINT-PLAN.md`), not a
   nice-to-have.
2. **`TS-M-004`** — falling notes hold 60 fps for a full 5-minute session with
   no visible stutter (`NFR-002`).
3. **`NFR-004`** — cold start to playable under 3 s. No automated check exists
   yet (`TS-E-002` is unwritten in the Sprint 1 scope) — time it by hand.
4. **`US-1.07` — remembered input, half closed.** `selectMidiInput()` (session,
   Note Ninja and chord stores) now writes the chosen input to the active
   profile's `midiInputId` (synced like any profile field), and the input list
   offers the remembered input first (`TS-I-MID-002`, `midiMemory.test.ts`).
   It does **not** yet reopen it unprompted on launch: each page still waits
   for one tap, because opening also unlocks audio (`TA-AUD-003`). Check at the
   piano that the right input is first in the list after a reload.

Run 1–4 at the piano before calling Sprint 1 formally closed.

---

## Sprint 2 — child's loop foundation slice (US-2.10, US-2.11, US-2.12)

Code-complete and green — typecheck, lint, unit tests (75/75), and
`docs-check` all pass. This is a foundation slice of the child's-loop track,
not the whole track: `Mary Had a Little Lamb` is split into 4 two-bar quest
sections plus one whole-piece reward section (`FR-EXP-001`, `FR-EXP-004`),
progression is derived from `attempts` at read time (`FR-PRO-002`), and
`/explorer` renders the quest map with locked/unlocked/starred state.

The manual smoke test (`/` → `/explorer` shows bars 1–2 unlocked and the rest
locked; completing bars 1–2 unlocks bars 3–4; clearing all 4 quests unlocks
the whole-piece reward) is bookmarked rather than run, same as Sprint 1's
`TS-M-*` items — it needs the physical instrument.

Deferred to a later slice: `US-2.13`–`US-2.20` (Note Ninja, `TimedMatcher`
tolerance grading, session structure, reward feedback, free play, golden
fixtures) and the remaining Sprint 2 track (profiles & sync).

---

## Sprint 2 — content pipeline slice (US-2.07, US-2.08, US-2.09)

Code-complete and green — `pnpm run content:build`, typecheck, lint, unit
tests (92/92), and `docs-check` all pass. `content/build/ingest.ts` ingests
hand-authored JSON tune sources (`content/sources/*.json`) through a shared
pure transform (`src/core/content/buildArrangement.ts`) into licence-checked,
difficulty-scored, section-segmented static JSON under `public/content/`;
`StaticContentBackend` (`src/adapters/content/static.ts`) fetches it instead
of importing it, matching `TA-PORT-003`. The catalogue grew from one
hardcoded piece to 8 (`FR-CON-002`): Hot Cross Buns, Jingle Bells, London
Bridge, Mary Had a Little Lamb, Ode to Joy, Old MacDonald Had a Farm, Row Row
Row Your Boat, Twinkle Twinkle Little Star — all five-finger C-position tunes
that score difficulty 1 under `scoreDifficulty` (`TA-CNT-002`), each with a
public-domain licence entry in `content/licences.json`.

`/explorer` split into a piece-list page and `/explorer/[arrangementId]`'s
quest map (unchanged quest-map logic, now reading the arrangement id from the
route instead of a hardcoded constant). Manually smoke-tested via
`pnpm run dev`: the piece list shows all 8 pieces, each links to its
`defaultArrangementId`, and the quest map renders the same locked/unlocked
section state as before.

A real bug was caught and fixed while implementing this: `scoreDifficulty`'s
`FIVE_FINGER_SPAN` constant was `4` semitones, but a five-finger hand
position (fingers on C-D-E-F-G) spans a perfect fifth — 7 semitones — so
ordinary five-finger melodies were being wrongly scored as needing a
hand-position shift. Fixed in `src/core/content/difficulty.ts`; the existing
`difficulty.test.ts` unit test (pre-existing, not part of this slice) caught
it.

**Known pre-existing issue, out of scope for this slice, flagged separately
for a follow-up session:** `pnpm run build` (the production static build)
fails on any route that imports `useSessionStore`
(`src/runtime/stores/sessionStore.ts`), because Zustand's `create()` calls
`getAdapters()` synchronously at module load, and `WebAudioBackend` throws
when constructed outside a browser during Next's static-prerender pass. This
predates the content pipeline — `src/app/explorer/play/[id]/page.tsx`
already had the same import before this slice — and was only surfaced now
because `pnpm run build` had apparently never been run to completion before.
It does not affect `pnpm run dev`'s client-side navigation (confirmed
working above), only a hard navigation/refresh and the production build.

---

## Sprint 2 — Note Ninja slice (US-2.13)

Code-complete and green — typecheck, lint (on the files this slice touched —
`pnpm run lint` also flags pre-existing `require()`/CJS warnings inside a
parallel session's `.claude/worktrees/*/.next` build output, unrelated to
this slice), and unit tests (100/100) all pass, and `docs-check` stays
green. A new pure module,
`src/core/flashcards/` (`responseBand.ts`, `deck.ts`, `TA-GRD-005`),
classifies elapsed response time into `fast` / `correct` / `hinted` bands and
draws the next card from a five-finger `C4`–`G4` pool without repeating the
previous card. `AudioBackend.now()` is read directly for elapsed time, not
through `MasterClock` — Note Ninja has no tempo map to bind to (`ADR-006`).

A new, separate Zustand store, `src/runtime/stores/noteNinjaStore.ts`, wires
the MIDI stream to the game loop. It deliberately calls `getAdapters()`
lazily inside each action rather than storing it as eagerly-evaluated initial
state, avoiding the pre-existing `sessionStore.ts` bug noted below (a
separate, already-in-progress fix). A wrong key reveals the hint immediately
— same as the 6 s timeout — and the card waits rather than ending the game
(`FR-EXP-003`, no failure state). The new route,
`src/app/explorer/ninja/page.tsx` (`TA-APP-003`'s reserved `/explorer/ninja`
path), is linked from the piece list. Manually smoke-tested via
`pnpm run dev`: the route renders (200 OK) with no console errors of its own
— the only runtime error seen is `NotAllowedError: Permission to use Web
MIDI API was not granted`, from the sandboxed browser having no MIDI
hardware/permission, not from this code. The full band/hint/streak loop
still needs verification at a physical piano.

Deliberately deferred to `US-2.14`: the `flashcards` IndexedDB store and any
spaced-repetition/Leitner-box scheduling for missed cards — this slice keeps
Note Ninja's state in memory only.

---

## Sprint 2 — bundled child's-loop slice (US-2.14–US-2.19)

All six remaining unblocked stories in the child's-loop track, implemented as
one pass (14 points) at the user's request, to cut down on one-story-at-a-time
back-and-forth. Code-complete — typecheck, lint, unit tests and `docs-check`
all green; `pnpm run build` (see below) also confirmed passing.

- **`US-2.14` Note Ninja spaced repetition** — new `Flashcard` type
  (`src/core/data/flashcard.ts`) and pure scheduler
  (`src/core/flashcards/scheduler.ts`, `TA-DAT-006`): a five-box Leitner
  schedule (`reviewCard`) now drives which pitch `noteNinjaStore` presents
  next, backed by the previously-unused `flashcards` IndexedDB store
  (`TA-DAT-003`).
- **`US-2.15` `TimedMatcher` + tempo-relative tolerance** —
  `src/core/match/tolerance.ts` and `src/core/match/timedMatcher.ts`
  implement `TA-MAT-003`/`TA-MAT-006` to the spec that was already written
  ahead of the code; `TS-U-MAT-010`–`018` now have real tests behind them.
  `DEFAULT_PROFILE.toleranceScale` corrected from `1` to `1.6`
  (`TS-U-MAT-018`). The practice route
  (`src/app/explorer/play/[id]/page.tsx`) gained a "Wait for me" / "Keep the
  beat" mode toggle so timed mode is reachable at the piano, not just
  unit-tested.
- **`US-2.16` universal star floor** — a real (if previously harmless) bug
  fixed: `src/core/grade/stars.ts:starsFor` only applied the Explorer floor
  when `completion === 1`, which already qualified for a star on its own, so
  the floor branch was dead code. `TA-GRD-002`'s doc text already specified
  the correct "any completed attempt" behaviour — the code was out of sync,
  not the doc. New test `TS-U-GRD-015` covers `completion < 1` with the
  floor on. This became load-bearing only once `TimedMatcher` (`US-2.15`,
  same bundle) could leave notes genuinely `missed`.
- **`US-2.17` session arc** — new pure `buildSessionArc`
  (`src/core/session/arc.ts`, `TA-APP-005`) sequences a free-play warm-up,
  2–3 under-practised quests, and a free-play wind-down; a small
  orchestration-only store (`src/runtime/stores/sessionArcStore.ts`) and a
  new route (`src/app/explorer/[arrangementId]/session/page.tsx`) drive it,
  reusing the existing quest map and practice routes rather than duplicating
  them. The practice page shows a "Continue your session" button in place of
  the bare star display only when `sessionArcStore.active` is true.
- **`US-2.18` immediate reward feedback** — `src/ui/shared/RewardBurst.tsx`,
  a CSS-animated star burst wrapped in `prefers-reduced-motion` (`NFR-011`);
  wired into both the practice route's completion state and Note Ninja's
  correct/fast/hinted result, alongside the existing (previously unused)
  `'star-earned'` audio cue (`TA-AUD-001`).
- **`US-2.19` free play** — new `src/ui/explorer/FreePlay.tsx` and route
  `src/app/explorer/free-play/page.tsx`: every `noteOn` above the velocity
  floor plays and displays the note, ungraded, no `Attempt` written
  (`FR-EXP-006`). Reused inline by `US-2.17`'s arc warm-up/wind-down steps.
  Linked from the piece list alongside Note Ninja.

`TA-APP-003`'s route table gained `/explorer/free-play` and
`/explorer/[arrangementId]/session`.

**The pre-existing `pnpm run build` / SSR crash (flagged in the content
pipeline slice above) is now confirmed fixed.** `sessionStore.ts` no longer
stores `adapters` as eagerly-evaluated state; every consuming page now calls
`getAdapters()` directly, the same lazy pattern the Note Ninja slice already
used. `pnpm run build` now succeeds end-to-end, including both new routes.

Manually smoke-tested via `pnpm run dev` (browser pane, no physical MIDI
device available): the piece list, `/explorer/free-play`'s device picker,
`/explorer/[arrangementId]`'s quest map, `/explorer/play/[id]`'s new mode
toggle, and `/explorer/[arrangementId]/session`'s first arc step all render
without error. **Not verified** (needs the physical piano): timed-mode
response bands under real playing, the "Continue your session" arc-gate
behaviour end-to-end (requires completing a real attempt), and reward-audio
quality. `prefers-reduced-motion` was verified by code review only — the
browser pane's viewport emulation doesn't expose a motion-preference toggle.

`docs/03-SPRINT-PLAN.md` / `docs/html/sprints.html` deliberately not
touched: all six stories are implemented exactly as already specified (14
points, unchanged).

---

## Sprint 2 — profiles slice (US-2.01)

The one remaining unblocked story that didn't need a piano or a Supabase
project. Implements `TA-DAT-004`'s already-specified `Profile` shape — no new
architecture, same pattern as the bundled slice above.

- New `src/core/profile/createProfile.ts` (pure factory, `TA-DAT-004`):
  role-based `toleranceScale` defaults per `TA-MAT-006` (1.6 explorer, 1.0
  student), fixed 21–108 keyboard range, zero latency offset. `id` is
  injected, never generated inside `core/` (`ADR-005`).
- New `src/runtime/stores/profileStore.ts`: `profiles`/`loaded` state,
  `loadProfiles`/`addProfile`/`selectProfile` actions (`crypto.randomUUID()`
  for new ids — a runtime-layer concern, not a fifth port; id generation
  isn't a piano-specific platform capability). `addProfile`/`selectProfile`
  call the new `sessionStore.setProfile()`, which every Explorer page
  already reads reactively (quest map, practice, session arc) — no
  per-page wiring needed there. `noteNinjaStore` keeps a non-reactive
  profile reference, so it gets an explicit bridge instead
  (`src/app/explorer/ninja/page.tsx` mirrors `sessionStore.profile` into
  `noteNinjaStore.setProfile()`).
- `src/app/page.tsx` rewritten from a static greeting into the real `/`
  picker (`'use client'`): tap a saved profile or add one (name, avatar,
  explorer/studio role), capped at 4 (`FR-PRO-001`), no password. Selecting
  or creating a profile routes to `/explorer`.
- The active profile is in-memory only (`sessionStore.profile`), not
  persisted across a hard reload — a direct reload returns to the `/`
  picker, matching `FR-PRO-001`'s "switching is one tap from the home
  screen." No profile is auto-seeded; an empty family sees an add-profile
  prompt instead of a generic placeholder.
- No `StorageBackend`/adapter changes: the `profiles` store, its `keyOf`
  (`String(id)`) and an empty-range `query` already supported this end to
  end.

New unit tests `TS-U-DAT-001`/`002` (`src/core/profile/createProfile.test.ts`)
cover the two roles' `toleranceScale` defaults, plus two further cases for
the fixed keyboard range/latency offset and pass-through fields (id,
displayName, avatar) — not separately numbered, following the same pattern
as other files' unnumbered supporting cases.

Manually verified via `pnpm run dev` (browser pane, no piano needed): added
a profile, confirmed it persists in IndexedDB across a reload, selecting it
routes to `/explorer`, and the stored record has the correct role-based
`toleranceScale`/`keyboardRange`.

`docs/03-SPRINT-PLAN.md`/`docs/html/sprints.html` deliberately not touched —
implemented to the story's existing 3-point scope, unchanged.

---

## Studio ideas — MVP scope and future roadmap

Four Studio ideas raised by the adult user, added to `docs/02-FUNCTIONAL-
SPECIFICATION.md` as `FR-STU-012`–`014`/`FR-PRO-006`. The adult reviewed all
four and confirmed three as committed v1 scope; the fourth stays deliberately
unscheduled. Sprint 3 as a whole is still gated on Sprint 2's exit criteria
(`RISK-005`) — these three simply take a place in that sprint's story list
once it starts, same as `US-3.01`–`US-3.12`.

**Committed to `Sprint 3` (`M`-priority):**

- **`FR-STU-012`** chord & progression explorer (`US-3.13`) — content source
  is [free-midi-chords](https://github.com/ldrolez/free-midi-chords) (MIT):
  its `chords.py` Roman-numeral progression sequences and mood tags
  (`prog_maj`/`prog_min`, 108 templates) are ported as text data; chord
  voicings/audio are this codebase's own generation, not parsed from the
  repo's MIDI files (`TA-CNT-006`). Expanded beyond passive browsing at the
  adult's request: a suggested chord
  is shown on the keybed and what's actually played is validated against it
  (`TA-MAT-007`, a new octave-invariant pitch-class-set matcher — distinct in
  kind from the sequential `WaitMatcher`/`TimedMatcher`, since a chord has no
  order to follow). No timing requirement, no failure state — this stays
  framed as low-pressure noodling, not a graded drill.
- **`FR-STU-013`** lead-sheet song mode (`US-3.14`) — chords + melody, no
  full notation. Renders with the existing falling-notes view (`TA-REN-001`)
  rather than a new renderer, with chord symbols overlaid as text at their
  tick position.
- **`FR-PRO-006`** saved/in-progress repertoire (`US-3.15`) — a small
  per-profile "my songs" list (`wantToLearn`/`learning`/`learned`), backed by
  a new `library` IndexedDB store (`TA-DAT-007`), synced last-write-wins on
  `updatedAtMs` — same policy class as `settings`/`profiles` (`TA-SYN-003`).

**Future roadmap, deliberately out of MVP scope:**

- **`FR-STU-014`** personal score import — bringing a teacher's digitised
  sheet into the app. The adult confirmed this is a nice-to-have, not a
  blocker, and is fine leaving it unscheduled. Rendering is solved (OSMD
  reads MusicXML, already chosen); getting the file *in* is not — no
  upload-capable port exists in the current five-port architecture
  (`TA-PORT-002`). Flagged as an open architecture question, not just an
  unscheduled story — revisit after v1 ships.

---

## Visual design system — DuoKeys Design Reference

The adult reviewed an 8-screen mockup set covering both Explorer and Studio
surfaces (quest map, falling notes, Note Ninja, Studio practice, Duet,
chords & progressions, song library, lead-sheet practice) and approved it as
the product's visual identity. Stored as the **DuoKeys Design Reference**
artifact (`CLAUDE.md` § 1.5). The platform name stays **DuoKeys** — a
name-change question was raised and explicitly declined.

Two decisions follow directly from that review:

- **`TA-APP-001`'s previously-open "Styling: CSS Modules or Tailwind — either,
  chosen once" row is now resolved**: CSS custom-property design tokens
  (`src/ui/shared/tokens.css`) consumed via CSS Modules per component. New
  section **`TA-APP-006`** captures the palette (paper/ink neutrals plus
  amber/indigo/coral role hues — coral reserved exclusively for shared
  duet moments), the type pairing (Bricolage Grotesque, Plus Jakarta Sans,
  IBM Plex Mono), and the shared keybed/card components.
- **DuoKeys commits to one theme, deliberately** — light only, no dark-mode
  toggle. This is a product decision, not an oversight: the palette's
  role-hue semantics would be undermined by a naive dark inversion.
  Revisit only via a new ADR if this stops serving the product.

No new `FR-*` was created — the mockups describe how the app looks, not new
user-facing behaviour; the Studio screens they depict are already specified
by `FR-STU-012`/`013`/`FR-PRO-006` above. Two new stories were added to
`Sprint 3` to turn the reference into code: **`US-3.16`** (design tokens +
shared components) and **`US-3.17`** (retrofit the Explorer surfaces already
shipped in Sprints 1–2, so the whole app matches, not just the screens built
after the reference existed). Both are numbered after `US-3.01`–`.15` (IDs
are never renumbered, `CLAUDE.md` § 1.4) but are placed first in the sprint's
story list, so the rest of Sprint 3 is built against the system from day
one. Sprint 3's point total moves 51 → 57; the v1 total moves 186 → 192.

`docs/02-FUNCTIONAL-SPECIFICATION.md` and `docs/04-TEST-SCENARIOS.md`
deliberately not touched — no new functional behaviour, and no meaningfully
unit-testable behaviour in a CSS/token system.

---

## Studio MVP + design system — delivered early, deliberately scoped down

By explicit user decision, six Sprint 3 stories shipped before Sprint 2's
observation-week exit criteria were met, so both the child's and the adult's
journeys could be tested together at the piano, wearing the approved
DuoKeys Design Reference. This is a **deliberate, narrow deviation from
`RISK-005`**, not a silent gate violation — see `RISK-005`'s updated row in
`docs/01-TECHNICAL-ARCHITECTURE.md` § 13 / `docs/html/architecture.html`.
The other 11 Sprint 3 stories (57 pts) stay unbuilt, specifically to keep
this risk's actual danger — unbounded scope creep into the adult module —
from materialising.

Delivered:

- **`US-3.16`** (design tokens + shared components) and **`US-3.17`**
  (Explorer restyle) — `PageShell`/`Button`/`Card` plus the paper/ink/
  amber/indigo/coral token set from the Design Reference, applied across
  every Explorer route and `/` itself; `choose()` now routes by
  `profile.role` (`'student'` → `/studio`, otherwise → `/explorer`) instead
  of always to `/explorer`.
- **`US-3.01`** (notation) and **`US-3.03`** (post-attempt note colouring) —
  `src/ui/notation/NotationView.tsx`, a real OSMD staff-notation view,
  cursor-synced to `matcherState.groupIndex` during an attempt and
  colouring each notehead green/red/grey from `grade.perNote` after one
  completes. Backed by a new pure `core/` converter,
  `src/core/content/toMusicXml.ts` (`TA-REN-003`), unit-tested in
  `TS-U-REN-008`–`010`.
- **`US-3.02`** (route-level code splitting, `TA-REN-004`/`NFR-006`) —
  `opensheetmusicdisplay` is never a static import; `NotationView` loads it
  via `await import('opensheetmusicdisplay')` inside its render effect, so
  the Explorer bundle never pays for it.
- **`US-3.05`** (tempo scale) — `MasterClock.setTempoScale` (already
  implemented, previously unwired) is now called from a 30–100% slider on
  `/studio/play/[id]`; `sessionStore`'s `finishAttempt` records the real
  scale instead of a hardcoded `1`.
- New routes: `/studio` (piece list) and `/studio/play/[id]` (MIDI picker,
  falling-notes/notation toggle, tempo slider, plain accuracy/stars
  display) — modeled on the existing `/explorer` routes, without quest or
  session-arc integration, since Studio practices a whole track, not
  quests.

`docs/03-SPRINT-PLAN.md`/`docs/html/sprints.html` deliberately not touched —
no story was added, split, or re-pointed, only implemented early, same
reasoning as `US-2.13`/the Sprint-2 bundle below.

Not built in this pass — the rest of Sprint 3's adult-loop stories
(`US-3.04`, `.06`–`.15`): loop range, auto-ramp, hand isolation, articulation
feedback, Hanon/sight-reading generation, rush/drag display, repertoire
ingestion, chord explorer, lead sheets, saved repertoire. Each is a real,
separate feature, not a styling gap.

---

## Group A — tempo & loop mechanics

`US-3.04` (A/B loop), `US-3.06` (auto-ramp), `US-3.11` (signed rush/drag
display) — the first of the seven-group roadmap covering the remaining
Sprint 3 stories (see `docs/03-SPRINT-PLAN.md` — points unchanged, 3+3+2).

- **`US-3.04`** — `MasterClock` gained `setLoop`/`clearLoop`/`loopRange`/
  `checkLoop` (`TA-CLK-002`): a half-open `[startTick, endTick)` range,
  polled once per RAF frame from `sessionStore`, that restarts playback at
  `loopStart` the instant position reaches `loopEnd` — independent of
  whether the notes played were correct, per `FR-STU-003`'s "loop that range
  indefinitely." `/studio/play/[id]` gained a measure-range picker built on
  `ticksPerMeasure` (now exported from `toMusicXml.ts`), so loop boundaries
  always land on a measure line.
- **`US-3.06`** — each time `checkLoop()` reports the boundary was crossed,
  `sessionStore`'s new `finishLoopPass` grades the pass just finished
  (`reconcileMissed` + `computeGrade`, the same pipeline `finishAttempt`
  already used), then — when auto-ramp is enabled — raises `tempoScale` 5%
  on a clean pass (`accuracy === 1`) or drops it one step otherwise, clamped
  to `MasterClock.setTempoScale`'s existing `[0.30, 1.00]` range, and
  re-arms the matcher for the next pass via `matcher.expect(allExpected)`
  without ending the attempt. The attempt only formally ends via the new
  explicit `stopLoop()` action.
- **`US-3.11`** — `describeRushDrag(rushDragMs)` (`src/core/grade/grade.ts`)
  turns the already-computed signed `Grade.rushDragMs` into the directional
  phrasing `FR-STU-008` calls for ("40 ms ahead of the beat" /
  "40 ms behind the beat" / "right on the beat"); `/studio/play/[id]`'s
  post-attempt summary now shows that sentence instead of a bare number.

New tests: `TS-U-CLK-011`–`014` (`src/core/time/masterClock.test.ts`),
`TS-U-GRD-018`/`019` (`src/core/grade/grade.test.ts`). `docs/01-TECHNICAL-ARCHITECTURE.md`
`TA-CLK-002` updated for the new loop API — and, while already touching that
block, corrected pre-existing drift: it documented a `wallToAudio` method on
`MasterClock` that never existed there (it's on the separate `DriftTracker`,
`TA-CLK-003`).

Not built yet at the time — `US-1.03` (Group E), per the same roadmap.
(Group G, `US-3.13`–`.14`, is delivered — see below.)

---

## Group B — hand & pedal feedback

`US-3.07` (hand mute), `US-3.08` (articulation/duration feedback) — the
second of the seven-group roadmap (see `docs/03-SPRINT-PLAN.md` — points
unchanged).

- **`US-3.07`** — `/studio/play/[id]` gained a track picker (radio buttons,
  labelled by `Track.hand` — "Left hand"/"Right hand" — when set) so the
  adult chooses which track is practised, plus an `AccompanimentMode`
  ('silent' | 'sampler') for how the other track(s) sound. `sessionStore`'s
  `startArrangement` scopes `ExpectedNote`s (and hence the matcher/grading)
  to only the selected track; the other tracks are scheduled straight
  against `MasterClock` by the new `scheduleAccompaniment`, at a softer
  fixed velocity, only when accompaniment mode is `'sampler'` — never fed to
  the matcher either way, so a wrong note in the accompaniment can't mark
  the attempt wrong. `Track.hand`/`role`, already on the content model, were
  previously unconsumed by anything in `match/` or the audio path; no
  content-model change was needed.
- **`US-3.08`** — new `TA-GRD-006`: `classifyArticulation`
  (`src/core/grade/articulation.ts`, pure `core/`) compares a held note's
  actual sounding duration against its written duration and returns
  `'short' | 'even' | 'long' | undefined`. Actual duration is sourced from
  `NoteStreamTracker.noteOn`/`noteOff`'s returned `NoteEvent`, gated by
  `PedalTracker.noteOff`/`cc64`'s key-up-vs-stopped-sounding distinction
  (`TA-MID-004`) so a sustained note isn't classified as short just because
  the key came up early. Written duration is computed in `sessionStore` via
  two `MasterClock.ticksToAudio` calls sharing one `startAudioTime` anchor
  (`ADR-006` — never a bare tick→ms conversion), not a new `MasterClock`
  method. `Grade.perNote[].articulation` is optional — the note that
  completes an attempt may still be sounding when grading fires, so it can
  go unclassified; this is a documented limitation, not a bug.
  `describeArticulation(grade)` (`src/core/grade/grade.ts`) summarises the
  classified notes into the sentence `/studio/play/[id]` now shows alongside
  the rush/drag line.

New tests: `TS-U-GRD-020` (short/even/long classification),
`TS-U-GRD-021` (unclassifiable when target duration ≤ 0) —
`src/core/grade/articulation.test.ts`, plus `describeArticulation` coverage
added to `src/core/grade/grade.test.ts`.

Not built yet at the time — `US-1.03` (Group E), per the same roadmap.
(Group G, `US-3.13`–`.14`, is delivered — see below.)

---

## Group C — generated content

`US-3.09` (Hanon 1–20 + evenness), `US-3.10` (generated sight-reading) — the
third of the seven-group roadmap (see `docs/03-SPRINT-PLAN.md` — points
unchanged, 5+5). Both are greenfield pure-`core/` generators; neither
required a new architecture doc ID — `TA-CNT-004` (Sources) and `TA-GRD-003`
(Evenness) already fully anticipated both deliverables.

- **`US-3.09`** — `generateHanonArrangement` (`src/core/content/hanon.ts`,
  pure `core/`, no injected randomness — a drill is deliberately identical
  every time) sequences a `HanonPattern`'s melodic cell up a major scale from
  `startDegree` through `ascendDegrees` steps and back down, both hands an
  octave apart. The note-generation logic is now factored into an exported
  `buildHanonSourceInput(pattern, options)`, reused by both
  `generateHanonArrangement` (which pipes it straight into
  `buildArrangementFromSource`, `TA-CNT-001` stages 3–6, for runtime use) and
  `content/build/ingest.ts`'s `loadHanonSources()` (for build-time use — see
  below), so the generated drill is difficulty-scored and sectioned exactly
  like hand-authored content either way. `HANON_PATTERNS` holds **5 of the
  eventual 20**: `hanon-01` is a verified transcription (Hanon No. 1,
  `cellDegrees: [0,2,3,4,5,4,3,2]`, C-E-F-G-A-G-F-E — this corrects a bug
  found in an earlier pass, where the array decoded to C-E-F-G-F-E-G-F and
  silently disagreed with its own comment). `hanon-02` through `hanon-05` are
  **original patterns in the Hanon style, not verified transcriptions of the
  real exercises** — each is titled `'Hanon-style Exercise N (approximate)'`
  in the UI rather than `'Hanon No. N'`, so the app never claims an
  authenticity it hasn't checked (`NFR-012`, no dark patterns, applies to
  honesty about content as much as to manipulative design). Patterns 6–20
  remain deferred. The generator itself is exercise-agnostic, so adding a
  pattern is a data entry, not new code. All 5 patterns are now emitted by
  `content:build` and licensed under a new `hanon-virtuoso-pianist-1900`
  `content/licences.json` entry (`sourceUrl` verified against Wikipedia —
  first published 1873, not 1900; 1900 is Hanon's death year, corrected from
  an earlier draft that conflated the two). `Grade.evennessCv`
  (`TA-GRD-003`, declared since the Studio MVP slice but never implemented)
  is now computed by `computeEvennessCv` in `src/core/grade/grade.ts`: the
  coefficient of variation (`stdev(iois) / mean(iois)`) of inter-onset
  intervals between correctly-played notes, undefined below three onsets or
  a zero-mean interval. It's fed by a new `NoteResult.onsetMs` field,
  captured in `sessionStore`'s `onMessage` handler at the moment a note
  matches `'correct'`.
- **`US-3.10`** — `generateSightReadingArrangement`
  (`src/core/content/sightReading.ts`, pure `core/`) takes an injected
  `random: () => number` source (matching `core/session/arc.ts`'s existing
  convention, not a new RNG port — `ADR-005`) plus key/pitch-range/rhythmic-
  vocabulary/bar-count options, and generates a stepwise-motion, diatonic,
  duration-vocabulary-constrained phrase, also through
  `buildArrangementFromSource` — so the matcher and notation view need no
  changes to play a generated phrase. Reuses `DIATONIC_PITCH_CLASSES`, now
  exported from `difficulty.ts` rather than duplicated. Now has a runtime
  caller: a new `/studio/sight-reading` page (key/length/tempo picker) calls
  it as `generateSightReadingArrangement(Math.random, {id: crypto.randomUUID(), ...})`
  at the runtime boundary, stashes the result in a new
  `generatedContentStore` (Zustand, in-memory `Map<string, Arrangement>`,
  deliberately never persisted — `TA-CNT-004` frames sight-reading as
  "Runtime", not build-time, so a reload regenerating a fresh phrase is
  correct, not a gap), and routes into the existing
  `/studio/play/[id]`, whose arrangement-load effect now checks
  `generatedContentStore` before falling through to the normal
  `content.arrangement()` adapter call. `src/app/studio/page.tsx` gained a
  "Generate a phrase" card linking to it. `Grade.evennessCv` is now surfaced
  on that same play page's completion card via a new `describeEvenness`
  helper (`src/core/grade/grade.ts`) — three plain-language bands ("very
  even" / "reasonably even" / "uneven — try a slower, steadier tempo") either
  side of the `<0.08`/`>0.20` thresholds `computeEvennessCv` already
  documented; before this, `evennessCv` was computed on every attempt but
  displayed nowhere, so `FR-STU-007`'s "graded on evenness" was true but
  invisible.
- **Incidental fix, discovered while building `US-3.09`**:
  `buildArrangementFromSource`'s `SourceInput` gained an optional
  `barsPerQuest` field (default 2, preserving every existing caller's
  behaviour unchanged) so a source can opt into a different fallback
  quest-section length than `TA-CNT-001` stage 5's documented 2-bar default.
  Hanon needed this because its own notation is 2/4 time (8 sixteenth notes
  per bar, matching the pattern cell exactly — a 4/4 bar would leave it
  half-empty) with one quest section per scale-degree step, not per pair of
  steps.

New tests: `TS-U-GRD-008`/`009` (`src/core/grade/grade.test.ts` — even and
lumpy `evennessCv`), `src/core/content/hanon.test.ts` (6 tests — the
original 5 plus a data-shape smoke test over all of `HANON_PATTERNS`:
unique non-empty ids, non-empty `cellDegrees`, positive
`noteDurationTicks`), `src/core/content/sightReading.test.ts` (7 tests).
`TS-G-007`/`TS-G-008` (golden-fixture Hanon evenness tests, per
`docs/04-TEST-SCENARIOS.md` § 9) remain an acknowledged gap — no
golden-fixture harness or recorded real-performance data exists anywhere in
this repo yet, for any content, not just Hanon.

Delivered this group, beyond the plan's original minimum: Studio UI wiring
(an adult can now start any of the 5 Hanon drills from the ordinary
`/studio` piece list, or a generated sight-reading phrase from
`/studio/sight-reading`) and content-build-pipeline integration
(`content/build/ingest.ts`'s `loadSources()` now also calls a new
`loadHanonSources()`, which maps `HANON_PATTERNS` through
`buildHanonSourceInput` and licenses the result under
`hanon-virtuoso-pianist-1900`; sight-reading deliberately stays
runtime-only, matching `TA-CNT-004`'s existing "Generated exercises |
Runtime" framing). Still deferred: Hanon patterns 6–20 (data-only, no code
change needed to add them) and the golden-fixture gap noted above.

Not built yet at the time — `US-1.03` (Group E), per the same roadmap.
(Group G, `US-3.13`–`.14`, is delivered — see below.)

---

## Group D — repertoire tracking

`US-3.15` (saved/in-progress repertoire, 2 pts) — the fourth of the
seven-group roadmap. Standalone and small: `TA-DAT-007`'s `LibraryEntry`
interface, the `library` store row, and the `/studio/library` route were all
already fully specified before this group's code existed — implementing a
spec, not writing one.

- Added `'library'` to `StoreName` (`src/adapters/ports.ts`) and `STORES`
  (`src/adapters/storage/idb.ts`), keyed `profileId+arrangementId` in
  `keyOf.ts` — the same compound-key shape `progression` already uses.
  Bumped `IdbBackend`'s `DB_VERSION` from 1 to 2 so the `idb` library's
  `upgrade()` callback actually re-runs and creates the new store in a
  browser with an already-existing `duokeys` database — adding a store name
  to `STORES` alone does nothing for an existing database without a version
  bump; this was caught by browser verification (an uncaught `NotFoundError`
  on `/studio`), not by the type system or the test suite, since
  `FakeStorageBackend` has no schema-versioning concept to get wrong.
- `src/core/data/library.ts` (new) — `LibraryEntry`/`LibraryStatus`, a pure
  data type mirroring `TA-DAT-007` verbatim, no logic.
- `src/runtime/stores/libraryStore.ts` (new, Zustand, `TA-APP-001`) —
  `loadLibrary`/`setStatus`/`clearStatus`. `setStatus` is an idempotent
  `put` (repeated calls with the same status just refresh `updatedAtMs`);
  `clearStatus` is a `delete`, not a fourth "none" status.
- `src/app/studio/page.tsx` — `LibraryControl`, a three-button row (Want to
  learn / Learning / Learned) per piece in the existing list; clicking the
  already-active button clears it. Delivered inline in `/studio` rather than
  as the separate `/studio/library` route `TA-APP-003` lists — see
  `TA-DAT-007`'s note on why.

New test: `TS-I-DAT-007` (`src/adapters/fake/library.integration.test.ts`) —
a status change overwrites rather than appends, delete actually removes the
row, and a query filtered by `profileId` never leaks another profile's
entries. The first of those three cases is also what `TS-U-DAT-003` already
specified; `TS-I-DAT-007` adds delete and profile-scoping coverage `TS-U-DAT-003`
didn't cover.

Not built yet at the time — `US-1.03` (Group E), per the same roadmap.
(Group G, `US-3.13`–`.14`, is delivered — see below.)

---

## Group F — content ingestion

`US-3.12` (Mutopia/OpenScore MusicXML import) — the fifth of the seven-group
roadmap (F before G, per the plan's suggested order — G's chord-explorer
subsystem is largest and goes last). Extends `TA-CNT-001` stage 1's own
original design (documented from the Sprint-2 slice as
`content/sources/**.{musicxml,mxl,mid,json}`) rather than adding a parallel
pipeline.

- **`src/core/content/parseMusicXml.ts`** (new, pure `core/`, `ADR-005`) —
  MusicXML → `SourceInput`, using `fast-xml-parser` (new dependency). Scope
  is deliberately bounded and documented in the file's own header and in
  `TA-CNT-001`: one `<part>` (solo piano), up to two staves (→ `rh`/`lh`),
  one voice per staff (`<backup>`/`<forward>` interleaving unimplemented — a
  second voice on a staff throws instead of silently mis-sequencing), a
  single global tempo/time/key taken from the file's first
  `<attributes>`/`<sound>`. Ties ARE merged — a `<tie type="stop">` extends
  the preceding same-pitch note's duration rather than becoming a second
  onset, the one case resolved rather than rejected, since silently
  importing a tie as two onsets would be a correctness bug, not just a
  missing feature. No grace notes, unpitched notes, or double sharps/flats —
  each throws a specific error, matching `TA-CNT-005`'s fail-the-build
  philosophy. `.mxl` and `.mid` stay out of scope this slice.
- **`src/core/content/buildArrangement.ts`** — `SourceNoteInput` gained
  `rest?: boolean` and `chord?: boolean` flags so the existing hand-authored
  JSON shape can express silences and simultaneous onsets, which MusicXML
  import needs and which JSON sources can now also use. `buildTrack`
  rewritten to skip rests (advancing the cursor without emitting a note) and
  to give a chord note its base note's start tick without double-advancing
  the cursor. Incidental fix found while adding chord support:
  `totalTicks` now takes the max end-tick over every note in a track, not
  just the tick-sorted array's last element — a chord note can share its
  base note's start tick but carry a shorter duration, so (once chords
  exist) the note that starts last isn't guaranteed to end last.
- **`content/build/ingest.ts`** — `loadSources()` now concatenates
  `loadJsonSources` (unchanged behaviour) with a new `loadMusicXmlSources`,
  which reads each `.musicxml` file's companion `*.meta.json` sidecar (`id`,
  `tags`, `licenceId`, optional `title`/`barsPerQuest` — fields MusicXML
  itself has no place for) and throws a clear error if the sidecar is
  missing.

New tests: `src/core/content/parseMusicXml.test.ts` (9 tests — single-staff
melody with a rest, two-staff split with a chord note, tie merging, a
mismatched tie-stop error, sharp/flat via `<alter>`, and 4 error-path tests
for multi-part, multi-voice-per-staff, grace notes, and double accidentals),
plus 3 new tests in `src/core/content/buildArrangement.test.ts` (rest
handling, chord handling, missing-pitch error). All 178 tests across the
suite pass, including the pre-existing golden Mary Had a Little Lamb test,
unaffected by the rest/chord changes.

Deliberately not done this group: no real Mutopia or OpenScore piece has
been ingested. Proving the importer against genuine external content needs
picking a specific piece and downloading it, which needs the user's
explicit go-ahead to fetch an external file — left as a follow-up rather
than done unprompted. The 7-fixture unit-test suite above is the
verification for this group; `pnpm run typecheck`, `pnpm run lint`, and
`pnpm run test:unit` are all clean for every file this group touched.

Not built yet at the time — `US-1.03` (Group E), per the same roadmap, plus
this group's own scope gap, a real ingested Mutopia/OpenScore piece (see
above). (Group G, `US-3.13`–`.14`, is delivered — see below.)

---

## Group G — chord explorer & lead sheets

`US-3.13` (chord & progression explorer, `FR-STU-012`), `US-3.14` (lead-sheet
song mode, `FR-STU-013`) — the sixth and last of the seven-group roadmap
(Group E, sync, stays deferred). `US-3.14` depends on `US-3.13`'s chord data
model, so both are one slice.

- **`content/build/ingestChords.ts`** emits `public/content/chords/index.json`
  — `ChordEntry`/`ProgressionEntry` shapes matching `TA-CNT-006`, generated
  by `src/core/content/chordCatalogue.ts` (`generateChordCatalogue`, pure
  `core/`, no injected randomness — deterministic and identical every
  build). Chord voicings (`midiNotes`, all 12 roots × 17 qualities = 204
  chords) come from this codebase's own chord-interval formulas — not
  parsed from the `ldrolez/free-midi-chords` MIDI corpus, since parsing
  standard MIDI files needs a binary SMF reader this codebase doesn't have
  (`decode.ts` only decodes live Web MIDI messages). Progression
  *sequences* and mood tags, however, **are** ported as text data from that
  repo (explicit user authorization, 2026-09-04): `chords.py`'s `prog_maj`
  (50 entries) and `prog_min` (58 entries) Roman-numeral degree/quality
  token lists live verbatim in `src/core/content/progressionData.ts`, parsed
  by a new `parseDegreeToken` and transposed into all 12 keys via the major
  or natural-minor scale-step table. The `prog_modal` list (chromatic/
  borrowed degrees) was not ported. `content/licences.json` carries two
  entries for this split: `duokeys-original-chord-catalogue` (voicings) and
  `free-midi-chords-progressions` (sequences/moods). Per key: 1
  hand-authored `12-bar-blues (turnaround)` stock progression + 50 ported
  major + 58 ported minor = 109 progressions (1,308 across all 12 keys).
- **`src/core/match/chordMatcher.ts`** (new) — `ChordMatcher`, sibling to
  `Matcher` (`TA-MAT-001`–`003`), not a variant of it: pitch-class-set
  (mod-12, octave-invariant) matching per `TA-MAT-007`, notes accumulated
  over a 150 ms wall-time co-incidence window, `TA-MAT-005`'s velocity floor
  applied, result is `complete`/`partial`/`ignored` only — no `wrong`, no
  timeout, since `FR-STU-012` is noodling, not a graded drill. Deliberately
  does not implement the `Matcher` interface — its result shape has no
  `wrong`/`extra`/group-position concept.
- **`src/runtime/stores/chordExplorerStore.ts`** (new, Zustand) — loads the
  chord catalogue, tracks MIDI connection/input selection (mirroring
  `sessionStore`'s pattern), selected key, current chord/progression, and
  feeds incoming MIDI through `ChordMatcher`.
- **`src/app/studio/chords/page.tsx`** (new) — key picker, diatonic chords
  for that key, the key's 109 progressions (1 stock 12-bar blues + 50 ported
  major + 58 ported minor) filterable by mode and mood, with a "next chord"
  advance, and a `ChordKeybed` (new shared component,
  `src/ui/shared/ChordKeybed.tsx`) highlighting target vs. played pitch
  classes.
- **`src/core/content/buildArrangement.ts`** — `SourceInput` gained an
  optional `chordMarkers?: ChordMarker[]` passthrough (`{atTick, symbol}`),
  converted to absolute ticks the same way notes are, and included on the
  output `Arrangement` only when the source has one (conditional spread —
  `exactOptionalPropertyTypes`, `CLAUDE.md` § 3 — so an arrangement with no
  chords omits the key entirely rather than setting it `undefined`).
- **`content/sources/hot-cross-buns-hands.json`** — the one hand-authored
  fixture given `chordMarkers` (alternating C/G), so `/studio/songs/[id]`
  has real content to render against.
- **`src/app/studio/songs/[id]/page.tsx`** (new) — reuses `sessionStore`'s
  existing MIDI/clock/matcher wiring (same pattern as `/studio/play/[id]`,
  simplified — no loop/tempo/notation toggle) and the existing
  `FallingNotesCanvas` (`TA-REN-001`) for the melody, passing
  `arrangement.chordMarkers` through as a new optional prop rather than
  building a second renderer, per `FR-STU-013`.
- **`src/ui/falling/FallingNotesCanvas.tsx`** — accepts the new
  `chordMarkers?: readonly ChordMarker[]` prop; each marker's `atTick`
  converts through `clock.ticksToAudio` the same way a note's `startTick`
  does, so the chord symbol falls at its tick position, not a fixed pixel
  offset.

New tests: `src/core/match/chordMatcher.test.ts` (8 tests — velocity floor,
partial/complete, octave-invariance, extra notes, co-incidence-window
expiry, `setTarget`/`reset` state), `src/core/content/chordCatalogue.test.ts`
(catalogue shape and counts — 204 chords, 1,308 progressions —, specific
chord voicings, `parseDegreeToken` correctness across all 12 suffix tokens,
diatonic-triad scoring, progression generation/transposition across keys and
modes, ported mood-tag presence), plus two new `buildArrangement.test.ts`
cases (chordMarkers passthrough, and correctly omitted — not `undefined` —
when absent). `docs/04-TEST-SCENARIOS.md` `TS-U-MAT-023`–`025` and
`TS-U-CNT-020` (catalogue tests) are satisfied as written; `TS-U-CNT-019` now
narrows its disclosure to chord voicings only (progression sequences/mood
tags are genuinely ported, per the update below), and `TS-U-REN-007` still
carries its disclosure note for the missing canvas-render unit test.

Deliberately not done this group: the `prog_modal` list (chromatic/borrowed
degrees) in `chords.py` was not ported — only `prog_maj`/`prog_min` (see
above); chord voicings/audio remain this codebase's own generation, not
parsed from the source repo's MIDI files (see above); `TS-U-REN-007` has no
automated test — the chord-symbol overlay lives inside
`FallingNotesCanvas`'s render loop, which nothing in this codebase currently
extracts into a testable pure function, so it was verified this session only
by browser inspection of `/studio/chords` and `/studio/songs/[id]`.
`pnpm run typecheck`, `pnpm run lint`, and `pnpm run test:unit` are all clean
for every file this group touched.

This closes the seven-group roadmap except **Group E** (`US-1.03`, Supabase
sync), which stays deferred until the user has a live Supabase project —
recommended and confirmed in the roadmap plan itself, not a gap.

---

## Next action

Sprint 2's content pipeline track, the Note Ninja slice (`US-2.13`), the
bundled child's-loop slice (`US-2.14`–`US-2.19`), and the profiles slice
(`US-2.01`) are all done. The sync track (`US-1.03` project and schema, `US-2.02`–`US-2.04` sign-in,
outbox and restore) is built — see Group E below. One track remains, blocked on
setup that isn't Claude's to do: `US-2.20` (golden fixtures) needs a real piano recording. Full physical-MIDI
verification of the bundled slice above (timed-mode bands, the arc gate,
reward audio) is also still outstanding and worth doing at the piano before
either track is picked up.

The minimal Studio slice above is implemented and unit-tested but not yet
verified at the piano — that verification (`/studio/play/[id]` with a real
MIDI device, confirming `grade.perNote` colours the notation view correctly
after a completed attempt) is the user's own next step, same as the
Sprint-2 bundle's outstanding physical-MIDI verification.

**Update, seven-group roadmap:** the paragraphs above predate Groups
A–G — kept as-is rather than rewritten, per this doc's own "never edit,
always append" convention for superseded status. Groups A, B, C, D, F, and
G are now all delivered (see their sections above); only **Group E**
(`US-1.03`, Supabase sync) remains, deliberately deferred until the user has
a live Supabase project. None of Groups A–G's new code has been verified at
a real piano yet — each group's own section above states this explicitly
where it applies (grading-affecting work — Group B's articulation, Group
C's evenness, Group G's chord matcher — most needs it; UI-only work least
does). That physical-MIDI verification, across every group, is the user's
own next step.

---

## Group E — Supabase project and schema (`US-1.03`, `TA-SYN-007`)

**Update, 2026-10-03** — the paragraphs above that call `US-1.03` unbuilt or
blocked predate this; kept as-is per this doc's append-only convention.

`US-1.03` is delivered: Supabase project `DuoKeys` (org `SMTCB`, region
`eu-central-1`) exists, the repo is linked to it with the Supabase CLI, and
its URL, anon key and database password are in the git-ignored `.env.local`.
The repo is public at `github.com/SMTCB/DuoKeys` (`main`). Migration
`supabase/migrations/20261003130000_sync_schema.sql` is applied and creates
`profiles`, `attempts`, `library` and `settings` with RLS on every table,
append-only `attempts` (select + insert only), last-write-wins triggers and a
server `synced_at` pull cursor — see `TA-SYN-007`.

Verified: anonymous reads and writes are refused on all four tables.

**Still open:**

- The Supabase GitHub integration (Project Settings → Integrations → GitHub)
  was authorised by the user in the dashboard on 2026-10-03 — done.
- `TS-I-SYN-004` now passes at the database level (`supabase/tests/rls.sql`).
- `SupabaseBackend`, magic-link sign-in (`US-2.02`), the outbox (`US-2.03`)
  and restore (`US-2.04`) are **built** and covered by fake-level tests
  (`TS-I-SYN-001`–`003`, `005`–`008`, `010`, `011`). Not yet verified: a live
  end-to-end push/pull with a real signed-in user, and the Studio sync panel in a
  browser. The sync panel's signed-out state was since checked in the dev
  browser. `TS-I-SYN-009` now has automated tests (network hung, a session's
  writes still complete).
- Hardening added: library clears propagate (tombstones), permanently rejected
  ops are dropped instead of wedging the queue, and flashcards sync
  (`TA-SYN-003`/`004`/`007`). The migration for this,
  `20261003150000_sync_flashcards_and_tombstones.sql`, was applied to the live
  project on 2026-10-03 and `supabase/tests/rls.sql` (extended to flashcards and
  tombstones) re-run and passed.
- Known gaps: Supabase redirect allow-list/Site URL must be set at deployment;
  built-in SMTP rate-limits magic-link emails.
- The temporary full-access Supabase personal access token used for setup
  should be deleted in the dashboard once no more CLI work is planned.

## Update — chord library, modal progressions and rhythmic styles (2026-10-03)

`FR-STU-015` / `US-3.18` grew beyond the typed-progression slice. All of it is
`TA-CNT-006`; no new requirement or component ID was needed.

- **Chord library:** 40 qualities × 12 roots = 480 chords (was 17 / 204), the
  full chord-type list of the free-midi-chords release, grouped Triads / 7ths &
  9ths / Other in the explorer.
- **Modal progressions:** the release's 82-entry modal set is ported
  (`ProgressionEntry.mode` gains `'modal'`); 191 progressions per key, 2,292 in
  all (was 1,308). Earlier notes in this file that say the modal list was not
  ported, or give 204 / 1,308, describe the state at that date.
- **SMF reader:** `src/core/midi/smf.ts` (`parseSmf`) — pure `.mid` parsing, which
  earlier entries said the codebase lacked.
- **Rhythmic styles:** 760 style files (pop, pop2, soul, hiphop2; reference key
  per set) shipped under MIT (`free-midi-chords-style-midi` licence entry,
  `content/chord-styles/NOTICE.md`) and transposed at play time.
- Tests: `TS-U-CNT-025`–`027`. 276 unit tests pass.
- **Checked against the release's MIDI:** every chord quality's pitch classes
  match; 24 of 2,292 progression chord sequences differ in the file's own
  voicing from the diatonic reading (upstream anomalies, left as ported).
- **Song library:** built afterwards — see the next update.

## Update — song library (2026-10-03)

`FR-STU-016` / `US-3.19`, built on the build-time-mirror route (a proxy would
have needed an ADR superseding the static export, `ADR-002`; file upload is a
different feature). No ADR and no new component ID: it extends `TA-CNT-006`
(shell, search, conversion), `TA-CNT-004` (the Mutopia MIDI source) and
`TA-CNT-005` (licence entries, new `cc-by-sa` status).

- **Content:** 576 solo keyboard pieces (piano, harpsichord, clavichord) of
  Mutopia's 744 piano listings; duets, voice and other instruments left out.
  Licences: 377 public domain, 128 CC BY-SA, 71 CC BY, one entry per piece in
  `content/licences.json` with its Mutopia page as `sourceUrl`, verified
  2026-10-03. Each library row shows its licence and links to that page.
- **Mirror:** `content/build/crawlMutopia.ts` and `fetchMutopiaMidi.ts` run by
  hand (about 7 MB of MIDI under `content/sources/mutopia/`); `ingestSongs.ts`
  is part of `content:build`.
- **In app:** `/studio/library` (search, style filter, add to / remove from "my
  songs", play), linked from `/studio`; play reuses `/studio/play/[id]`
  (`mutopia-<n>` ids). "Add" stores the id on the profile's settings record, so
  it syncs; the MIDI is a static asset fetched on play.
- **Limits:** MIDI only, so no engraved score and no notation view for a full
  piece; Mutopia's MIDI is flat in dynamics. The hand split is by track order,
  else middle C — worth checking on real pieces at the piano (`TS-M-015`).
- Tests: `TS-U-CNT-028`, `029`, `TS-I-DAT-009`. 289 unit tests pass.
- **Not verified at a real piano.**

## Update — chord screen declutter (2026-10-03)

`US-3.20` under `FR-STU-015`. `/studio/chords` held 282 buttons in about 5,000
px with the keybed at the very bottom. It is now one compact top bar (piano
status, key), a "now playing" keybed pinned at the top, and three tabs: Chords
(diatonic chords first, the rest in collapsible groups), Progressions (mode
switch, mood dropdown, 12 rows at a time, each row showing the chords in the key)
and My progressions (add form and saved list). Progressions with an identical
chord sequence are listed once. No new ID, no ADR; `TA-APP-003`'s route is
unchanged. Page-only change, so no new automated test; `TS-M-016` is the manual
check at the piano and is not yet run.

## Update — profile screen on a phone (2026-10-03)

A fix to `US-2.01`'s picker, no new ID. On a phone the avatar row could not wrap,
so the page scrolled sideways ("wobbly"); `PageShell` now stops content widening
the page. The screen now opens on "Who's playing?" with large avatar tiles, the
add form sits behind "+ Add a profile", Explorer / Studio are two picture
buttons ("for kids" / "for grown-ups"), and the name field is 16 px so iPhone
does not zoom. Checked at 375 px in the browser; not yet on a real phone.

## Update — brand shell and picture cards (2026-10-03)

`US-3.21` under `TA-APP-006`, no FR and no ADR. The tokens already matched the Design
Reference; what the live screens lacked was the identity itself. `PageShell` now shows
the logo lockup, a role pill and a role-coloured wash on every route; the Explorer
and Studio homes use picture cards (`ActionCard`); page titles use the reference
type scale; the mark is the favicon. Studio's sign-in panel moved below the
destinations. Checked in the browser at desktop and 375 px (no sideways scroll);
not yet on a real phone or iPad.

Second pass, same story: every other screen now uses the shared kit (`MidiChooser`,
`Segmented`, `Pill`, the big-note card). The Explorer quest map is a winding path of
numbered stops; Note Ninja, Free Play, the falling-notes screen, the session arc,
sight-reading and Studio practice share the same picker and choices; form controls
look the same everywhere. Verified at 375 px (no sideways scroll) on the Studio
screens, Note Ninja, Free Play and the quest map. Not checked in a browser: the
live falling-notes and notation views, the song page, the chord progression page
(they need a connected piano).

Third pass (`US-3.21`): the screens that need no piano are done too — the song library
rows and search, the chord explorer (key, tabs, filters, progression rows, add form),
the backup panel, and the setup / result states of the song page and chord-progression
page. Checked at 375 px (no sideways scroll) on the library and the chord explorer.
The setup and result states of the song and chord-progression pages were not seen in a
browser (they need a connected piano).

Fourth pass (`US-3.21`): nothing that can be drawn without a piano is left plain. This
covers the loading and error notes, a not-found page, the chord keybed (dot and tick
marks), the falling-notes canvas (fits the screen, role colours, outline on the waited
note), the Studio pieces rows and status pills, the Studio play controls and result,
sight-reading's tempo, and the chord explorer's top bar, now-playing card and your own
progressions. Checked at 375 px with no sideways scroll on Studio home, the chord
explorer, the Studio play setup, the not-found page and the error note. The canvas was
checked on a temporary page with a stopped clock; that page is deleted. Not checked:
the canvas while playing, the loop status, and the play result, because all three need
a connected piano.

Studio in three tracks (`US-3.22`, `FR-STU-017`–`019`): Learn, Free play and Songs, with custom songs (a pasted chord chart or a MIDI / MusicXML file, kept in "my songs" on the profile's settings record, no new table), a "play something for me" generator, 15 avatars (all instruments), profile restore after sync, and the chosen profile remembered per device in localStorage. Checked in a browser at 375 px: the Songs hub, adding and replaying a chart, a direct reload of a custom song, Free play and Learn. 301 unit tests pass. Not checked: MIDI / MusicXML import through the screen, restore across two real devices (`TS-M-017`), and emoji drawing on the phone.

Follow-ups to `US-3.22`: the Learn page now has "Mark done" ticks (`FR-STU-019`, `learnDone` on the settings record, `TS-I-DAT-011`); a MIDI or MusicXML file is checked when it is added and refused if it does not play (a corrupt file used to be saved and fail at play time); a MusicXML piece with an odd bar count now plays with one-bar sections instead of failing; `TS-I-DAT-010` covers the custom-song store. 309 tests pass. Now checked in a browser: MIDI and MusicXML import through the screen, the refusal of a corrupt file, ticks surviving a reload. Earlier worry withdrawn: a restore cannot exceed the four-profile limit, because the limit only gates adding a profile. Still not checked: restore across two real devices and emoji drawing on the phone.
