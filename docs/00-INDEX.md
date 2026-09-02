# DuoKeys — Documentation Index

**Version:** 1.0 · **Date:** 2 September 2026 · **Status:** Baselined, ready to build

A local-first web app that connects to a digital piano over USB MIDI and teaches
a six-year-old and an adult beginner to play — separately, and together.

---

## The document set

| # | Document | ID | Contains |
|---|---|---|---|
| 01 | [Technical Architecture](01-TECHNICAL-ARCHITECTURE.md) | `TECH` | 9 ADRs, ports & adapters, clock, MIDI pipeline, matcher, grading, renderers, data model, sync, content pipeline, 12 NFRs, 8 risks |
| 02 | [Functional Specification](02-FUNCTIONAL-SPECIFICATION.md) | `FUNC` | 47 requirements across 7 modules, prioritised MoSCoW |
| 03 | [Sprint Plan & User Stories](03-SPRINT-PLAN.md) | `SPRINT` | 6 sprints, 67 user stories, each mapped to FR and TA IDs |
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
| FR-EXP-005 Note Ninja | S | TA-DAT-003 | US-2.13, US-2.14 | TS-E-006, TS-E-007 |
| FR-EXP-006 free play | S | TA-AUD-001 | US-2.19 | TS-M-006 |
| FR-EXP-007 generous grading | M | TA-GRD-002, TA-MAT-006 | US-1.13, US-2.15, US-2.16 | TS-U-GRD-001…005 |
| FR-EXP-008 rewards | S | TA-AUD-001, NFR-011 | US-2.17, US-2.18 | TS-E-013 |
| FR-STU-001 notation | M | TA-REN-003 | US-3.01 | TS-M-010 |
| FR-STU-002 note colouring | M | TA-REN-003, TA-GRD-001 | US-3.03 | TS-M-010 |
| FR-STU-003 A/B loop | M | TA-CLK-002 | US-3.04 | TS-E-010 |
| FR-STU-004 tempo + auto-ramp | M | TA-CLK-002 | US-3.05, US-3.06 | TS-U-CLK-003, TS-E-011 |
| FR-STU-005 hands separate | M | TA-AUD-002 | US-3.07 | TS-M-009 |
| FR-STU-006 articulation | S | TA-MID-004 | US-1.09, US-3.08 | TS-U-PED-001…006 |
| FR-STU-007 Hanon evenness | S | TA-GRD-003 | US-3.09 | TS-U-GRD-008/009, TS-G-007/008 |
| FR-STU-008 rush/drag | M | TA-GRD-001 | US-3.11 | TS-U-GRD-006, 007 |
| FR-STU-009 per-measure | S | TA-GRD-004 | US-4.06 | TS-U-GRD-010 |
| FR-STU-010 sight-reading gen | S | TA-CNT-004 | US-3.10 | TS-M-009 |
| FR-STU-011 repertoire ingest | C | TA-CNT-001 | US-3.12 | TS-U-CNT-001…004 |
| FR-DUO-001 split + transpose | M | TA-DAT-001 | US-4.01 | TS-E-015, TS-M-012 |
| FR-DUO-002 dual matchers | M | TA-MAT-001 | US-4.02 | TS-U-MAT-021, TS-G-010 |
| FR-DUO-003 asymmetric parts | M | TA-DAT-001 | US-4.03 | TS-M-011 |
| FR-DUO-004 shared result | S | TA-GRD-001 | US-4.04 | TS-M-011 |
| FR-PRO-001 profiles | M | TA-DAT-004 | US-2.01 | TS-I-DAT-006, TS-E-005 |
| FR-PRO-002 progression | M | TA-DAT-003 | US-2.12 | TS-U-PRO-001…005, TS-I-DAT-004, TS-E-004 |
| FR-PRO-003 history | M | TA-DAT-002 | US-1.14 | TS-I-DAT-001, 002 |
| FR-PRO-004 dashboard | S | TA-GRD-004, TA-SYN-001 | US-4.06, US-4.07 | TS-U-GRD-010 |
| FR-PRO-005 recording | C | TA-DAT-002 | US-4.05 | — |
| FR-CON-001 static content | M | TA-DAT-005, TA-CNT-001 | US-2.07 | TS-U-CNT-001…004 |
| FR-CON-002 beginner catalogue | M | TA-CNT-003 | US-2.09 | TS-U-CNT-012, TS-M-006 |
| FR-CON-003 segmentation | M | TA-CNT-001 | US-2.07 | TS-U-CNT-007, 008 |
| FR-CON-004 licence gate | M | TA-CNT-005 | US-2.08 | TS-U-CNT-009, 010 |
| FR-SYN-001 auth | M | TA-SYN-002 | US-1.03, US-2.02 | TS-I-SYN-004 |
| FR-SYN-002 background sync | M | TA-SYN-001/004 | US-2.03 | TS-I-SYN-001…003, 009 |
| FR-SYN-003 device restore | M | TA-SYN-001 | US-2.04 | TS-I-SYN-005, TS-E-009 |
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
4. **`US-1.07` gap** — `selectMidiInput()` in `src/runtime/stores/sessionStore.ts`
   opens the chosen MIDI input for the session but never writes it to the
   `settings` store, so the "have it remembered" half of the story doesn't
   survive a reload yet. Not a test to run — a small fix still owed.

Run 1–3 at the piano before calling Sprint 1 formally closed; fix 4 whenever
convenient (does not need hardware).

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
fixtures) and the other two Sprint 2 tracks (profiles & sync; content
pipeline).

---

## Next action

Sprint 2 continues (`docs/03-SPRINT-PLAN.md`) — the sprint has three largely
independent tracks (profiles & sync, content pipeline, the child's loop).
`US-1.03` (a real Supabase project) is still not created — that action is the
user's to take, not Claude's — so the sync stories (`US-2.02`–`US-2.06`) stay
blocked until it exists; the other two tracks do not depend on it. Within the
child's-loop track, `US-2.13` onward (Note Ninja) is next once the foundation
slice above is manually verified at the piano.
