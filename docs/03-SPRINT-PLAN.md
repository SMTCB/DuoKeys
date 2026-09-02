# DuoKeys — Sprint Plan & User Stories

**Document ID:** SPRINT
**Version:** 1.0
**Date:** 2 September 2026
**References:** [01-TECHNICAL-ARCHITECTURE.md](01-TECHNICAL-ARCHITECTURE.md) ·
[02-FUNCTIONAL-SPECIFICATION.md](02-FUNCTIONAL-SPECIFICATION.md)

---

## Sprint strategy

**Vertical slices, riskiest first.** Every sprint ends with something that can be
played at the piano, not with a completed layer. The reason is `RISK-001`: the
entire project rests on whether the timing feels right, and no amount of
architecture makes that question answerable from a desk.

**Story ID scheme:** `US-<sprint>.<nn>`. Each story lists the `FR-*` it delivers
and the `TA-*` it builds against. Estimates are in points where 1 point ≈ half a
focused day.

**Definition of Ready:** the story names its FR and TA references, its acceptance
criteria are testable without a human judgement call, and its test scenarios exist
in [04-TEST-SCENARIOS.md](04-TEST-SCENARIOS.md).

**Definition of Done** — see [05-ENGINEERING-HANDBOOK.md](05-ENGINEERING-HANDBOOK.md#definition-of-done).

---

## Sprint 0 — Hardware spike · 1–2 days

> **The only sprint with a go/no-go gate.** Nothing else is built until this is
> answered. One HTML file, no framework, no repo structure.

**Goal:** know the real latency of the real instrument on the real laptop.

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-0.01` | As the developer, I can open the piano's MIDI input in Chrome and see note-on events logged with timestamps, so that I know Web MIDI works with this instrument at all. | FR-SYS-001 | TA-PORT-002, TA-MID-002 | 1 |
| `US-0.02` | As the developer, I can see a rectangle light up within one frame of pressing a key, so that I can judge visual latency by eye. | — | TA-REN-001 | 1 |
| `US-0.03` | As the developer, I can trigger a Tone.js note on key press, so that I can judge audio latency by ear. | — | TA-AUD-001 | 1 |
| `US-0.04` | As the developer, I can measure round-trip latency numerically by tapping along to a click and reading the median offset, so that the calibration approach is proven before it is built properly. | FR-SYS-002 | TA-CLK-004 | 2 |
| `US-0.05` | As the developer, I can confirm the instrument sends CC64 sustain and note-on-velocity-0, so that TA-MID-002 and TA-MID-004 are built against reality rather than assumption. | — | TA-MID-002, TA-MID-004 | 1 |

**Exit criteria**
- Measured latency is known and recorded in the repo.
- The instrument's MIDI quirks (velocity-0 note-off, active sensing rate, CC
  behaviour) are documented.
- **Go/no-go:** if latency after calibration is above ~80 ms and cannot be
  reduced, stop and reconsider before building anything.

---

## Sprint 1 — Walking skeleton · ~1 week

> Every hard problem in the project gets touched exactly once. Nothing is polished.
> Styling is "legible" and no further.

**Goal:** a child can sit at the piano, play eight bars in wait mode, and see stars.

### Foundation

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-1.01` | As the developer, I have a Next.js + TypeScript repo with the four-layer structure and the boundary lint rule failing CI on violation, so that the iPad path cannot silently close. | — | TA-PORT-001, TA-PORT-005, TA-APP-001 | 2 |
| `US-1.02` | As the developer, I have the five port interfaces defined and a fake implementation of each, so that core logic is testable with no hardware. | — | TA-PORT-002, TA-PORT-004 | 2 |
| `US-1.03` | As the developer, I have a Supabase project created and its credentials in env, so that the seven-day pause clock never becomes a Sprint 2 surprise. | FR-SYN-001 | TA-SYN-006, ADR-004 | 1 |

### Clock

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-1.04` | As the system, I convert between wall, audio and musical time through one `MasterClock`, so that grading and playback never disagree. | — | TA-CLK-001, TA-CLK-002, ADR-006 | 3 |
| `US-1.05` | As the system, I correct wall-clock drift toward the audio clock with an EMA, so that a ten-minute session does not accumulate a perceptible offset. | — | TA-CLK-003 | 2 |
| `US-1.06` | As a player, I can run a tap-along calibration and have my latency offset stored, so that the app grades what I actually played. | FR-SYS-002 | TA-CLK-004 | 3 |

### MIDI

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-1.07` | As a player, I can select my piano from a list of MIDI inputs and have it remembered, so that I do not reconfigure every session. | FR-SYS-001 | TA-PORT-003, TA-MID-001 | 2 |
| `US-1.08` | As the system, I decode note-on, note-off, velocity-0-as-note-off and CC64, and silently swallow active sensing, so that the event stream is clean. | — | TA-MID-002, TA-MID-003 | 2 |
| `US-1.09` | As the system, I track sustain pedal state and distinguish "key up" from "note stopped sounding", so that grading and rendering each get the event they need. | FR-STU-006 | TA-MID-004 | 3 |

### Play loop

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-1.10` | As a player, I see falling bars descend toward a hit line above an on-screen keybed at 60 fps, so that the mapping from screen to hands is spatial. | FR-EXP-002 | TA-REN-001, TA-REN-002, NFR-002 | 5 |
| `US-1.11` | As a beginner, the stream waits at the hit line until I play the right notes, with no timer and no penalty, so that there is no failure state. | FR-EXP-003 | TA-MAT-001, TA-MAT-002 | 3 |
| `US-1.12` | As a player, notes within 30 ticks of each other count as one chord decision, so that a rolled chord is not three errors. | — | TA-MAT-004 | 2 |
| `US-1.13` | As a player, I can play one hard-coded eight-bar tune end to end and receive 0–3 stars. | FR-EXP-007 | TA-GRD-001, TA-GRD-002 | 3 |
| `US-1.14` | As a player, my attempt is saved to IndexedDB and survives a browser restart. | FR-PRO-003 | TA-DAT-002, TA-DAT-003, NFR-007 | 2 |

**Out of scope this sprint:** auth, sync flush, content pipeline, second module,
Note Ninja, styling.

**Exit criteria**
- A child completes eight bars in wait mode and sees stars, unassisted.
- CI is green, boundary lint passes, `TS-U-*` fixtures run without hardware.
- Cold start to playable is under 3 s (`NFR-004`).

---

## Sprint 2 — The child's loop, for real · ~2 weeks

> The sprint that decides whether the product exists. Its exit criterion is
> behavioural, not technical.

**Goal:** a week of real daily use by the child with no developer present.

### Profiles and sync

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-2.01` | As a family, we have separate profiles with our own names, avatars and calibration, switchable in one tap without a password. | FR-PRO-001 | TA-DAT-004 | 3 |
| `US-2.02` | As the adult, I sign in with an email magic link, so that the household has an account without the child having credentials. | FR-SYN-001 | TA-SYN-002 | 3 |
| `US-2.03` | As the system, I queue every syncable write to an outbox and flush it in the background when online, never blocking a practice session. | FR-SYN-002 | TA-SYN-001, TA-SYN-004 | 5 |
| `US-2.04` | As the adult, signing in on a new laptop restores all profiles and practice history, so that a lost machine does not cost a year of progress. | FR-SYN-003 | TA-SYN-001, TA-SYN-003 | 3 |
| `US-2.05` | As the household, my data is protected by row-level security on every table, so that no other account can read it. | FR-SYS-008 | TA-SYN-005 | 2 |
| `US-2.06` | As a player, the app works identically with the network off and shows no error state for being offline. | FR-SYN-005 | ADR-003, NFR-005 | 2 |

### Content

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-2.07` | As the developer, a build script ingests source files and emits normalised, grouped, segmented, difficulty-scored arrangement JSON. | FR-CON-001, FR-CON-003 | TA-CNT-001, TA-CNT-002 | 5 |
| `US-2.08` | As the developer, the build fails if any piece lacks a licence entry with a source URL and verification date. | FR-CON-004 | TA-CNT-005 | 1 |
| `US-2.09` | As a child, I have 8–12 pieces at difficulty 1–2 sequenced along the standard beginner progression, so that the order matches what a teacher would do. | FR-CON-002 | TA-CNT-003, ADR-008 | 5 |

### The loop

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-2.10` | As a child, I see a map of pieces as nodes with stars and locks, so that I can see where I am going. | FR-EXP-001 | TA-APP-003, TA-DAT-001 | 3 |
| `US-2.11` | As a child, I practise two-bar sections rather than whole pieces, so that something is completable in under a minute. | FR-EXP-004 | TA-DAT-001, TA-CNT-001 | 3 |
| `US-2.12` | As a child, completing a section at ≥ 1 star unlocks the next one. | FR-PRO-002 | TA-DAT-003 | 2 |
| `US-2.13` | As a child, I play Note Ninja where a note appears and I play it, with response-time bands instead of a countdown and a hint after 6 s. | FR-EXP-005 | TA-DAT-003 | 5 |
| `US-2.14` | As a child, wrong answers in Note Ninja re-queue the card via spaced repetition rather than ending the game. | FR-EXP-005 | TA-DAT-003 | 3 |
| `US-2.15` | As a player, timed mode grades against tempo-relative tolerance windows with an absolute floor, so that the same setting feels right at 60 and 160 bpm. | FR-EXP-007 | TA-MAT-003, TA-MAT-006, ADR-007 | 3 |
| `US-2.16` | As a child, any completed attempt earns at least one star and errors are phrased as "try again", never as a deduction. | FR-EXP-007 | TA-GRD-002 | 1 |
| `US-2.17` | As a child, a session has a warm-up, two or three quests and a wind-down, so that practice ends on enjoyment. | FR-EXP-008 | — | 3 |
| `US-2.18` | As a child, I get an immediate sound and animation reward on success, suppressed under `prefers-reduced-motion`. | FR-EXP-008 | TA-AUD-001, NFR-011 | 2 |
| `US-2.19` | As a child, I can play freely with no grading and hear every key respond. | FR-EXP-006 | TA-AUD-001 | 2 |
| `US-2.20` | As the developer, a golden fixture suite replays recorded performances through the matcher and asserts exact grades, so that tuning tolerance never silently breaks grading. | — | TA-PORT-004 | 3 |

**Exit criteria**
- The child uses it daily for a week with no developer present.
- **Expect to discard at least one designed feature.** If nothing is discarded,
  the observation was not honest.
- Sync round-trips between two browsers.

---

## Sprint 3 — The adult's loop · ~2 weeks

> **Gated on Sprint 2's exit criteria actually being met** (`RISK-005`). Do not
> start this to avoid confronting a child's-loop problem.

**Goal:** you practise with it yourself for a week and prefer it to the alternative.

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-3.01` | As an adult, I practise from real notation with a cursor driven by what I actually play. | FR-STU-001 | TA-REN-003 | 5 |
| `US-3.02` | As an adult, OSMD loads only on Studio routes and never appears in the Explorer bundle. | — | TA-REN-004, NFR-006 | 2 |
| `US-3.03` | As an adult, after an attempt each note is coloured by result, applied after rather than during the performance. | FR-STU-002 | TA-REN-003, TA-GRD-001 | 3 |
| `US-3.04` | As an adult, I select a start and end measure and loop that range indefinitely. | FR-STU-003 | TA-CLK-002 | 3 |
| `US-3.05` | As an adult, I scale tempo from 30–100% of written. | FR-STU-004 | TA-CLK-002 | 2 |
| `US-3.06` | As an adult, auto-ramp raises tempo 5% after a clean pass and drops one step after a failed pass, so that the controls become a practice method. | FR-STU-004 | TA-CLK-002 | 3 |
| `US-3.07` | As an adult, I practise one hand while the other is muted, silent, or played by the sampler. | FR-STU-005 | TA-AUD-002, TA-DAT-001 | 3 |
| `US-3.08` | As an adult, I am told when notes are held too short or too long relative to the written articulation. | FR-STU-006 | TA-MID-004 | 3 |
| `US-3.09` | As an adult, Hanon exercises 1–20 are generated from patterns and graded on evenness. | FR-STU-007 | TA-GRD-003, TA-CNT-004 | 5 |
| `US-3.10` | As an adult, I get unlimited generated sight-reading constrained by key, range, rhythm and difficulty. | FR-STU-010 | TA-CNT-004 | 5 |
| `US-3.11` | As an adult, I see my signed rush/drag in milliseconds rather than an RMS number. | FR-STU-008 | TA-GRD-001 | 2 |
| `US-3.12` | As an adult, I can ingest Mutopia and OpenScore MusicXML through the build pipeline. | FR-STU-011 | TA-CNT-001, TA-CNT-004 | 3 |

**Exit criteria**
- You use it for your own practice for a week and prefer it to the alternative.
- If you don't, fix that before adding anything else.

---

## Sprint 4 — Together, and looking back · ~2 weeks

**Goal:** parent and child play four hands and both see their own result. The
original brief is delivered.

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-4.01` | As two players, the keyboard splits at a configurable point and each half is transposed so we both get our own middle C. | FR-DUO-001 | TA-DAT-001 | 5 |
| `US-4.02` | As two players, we are graded by two independent matchers so one person's mistakes never fail the other. | FR-DUO-002 | TA-MAT-001 | 3 |
| `US-4.03` | As two players, the primo part is five notes in one position while the secondo carries harmony and pulse, and either part can also be practised alone. | FR-DUO-003 | TA-DAT-001 | 3 |
| `US-4.04` | As two players, we see our own results side by side plus one celebratory "together" score. | FR-DUO-004 | TA-GRD-001 | 3 |
| `US-4.05` | As a player, I can record a performance and play it back with the score or falling notes following along. | FR-PRO-005 | TA-DAT-002, TA-AUD-002 | 5 |
| `US-4.06` | As an adult, I see streaks, bench time, accuracy trend and per-measure rush/drag, drawn from synced history across devices. | FR-PRO-004, FR-STU-009 | TA-GRD-004, TA-SYN-001 | 5 |
| `US-4.07` | As a child, I see a simplified, celebratory version of the dashboard. | FR-PRO-004 | — | 2 |
| `US-4.08` | As a player, I can install the app to my desktop and the screen never sleeps mid-piece. | FR-SYS-006 | TA-APP-004 | 3 |
| `US-4.09` | As a player, a mid-session disconnect pauses cleanly, preserves the attempt and offers a calm reconnect. | FR-SYS-004 | TA-MID-005 | 3 |
| `US-4.10` | As a visitor on an unsupported browser, I see a plain explanation and a list of browsers that work. | FR-SYS-005 | — | 1 |
| `US-4.11` | As a player, I see a quiet sync status in settings showing last-synced and pending items. | FR-SYN-004 | TA-SYN-004 | 2 |

**Exit criteria**
- Parent and child play four hands together and both see their own result.
- The v1 brief is complete.

---

## Sprint 5 — The iPad, if it still matters · optional, ~1 week

> **Prerequisite, arrange before starting** (`RISK-008`): a Mac. Xcode is
> macOS-only. Options are a rented Mac (MacinCloud), a cloud build service
> (Codemagic), or borrowed hardware. Also required: an Apple Developer account.

**Goal:** the same build runs on the iPad with one adapter swapped.

| ID | Story | FR | TA | Pts |
|---|---|---|---|---|
| `US-5.01` | As the developer, the Next.js app builds under `output: 'export'` with no server-only features on the runtime path. | — | ADR-002, TA-APP-001 | 2 |
| `US-5.02` | As the developer, a Capacitor shell wraps the exported app and runs it on an iPad. | — | ADR-002 | 2 |
| `US-5.03` | As the developer, a Swift CoreMIDI Capacitor plugin implements the `MidiBackend` port with identical semantics to the Web MIDI adapter. | FR-SYS-001 | TA-PORT-002, TA-PORT-003 | 8 |
| `US-5.04` | As the developer, swapping the MIDI adapter is a one-line change in the composition root with no change to `core/`, `ui/` or content. | — | TA-APP-002 | 1 |
| `US-5.05` | As the family, the app is provisioned and installable on our own iPad. | — | — | 3 |

**Exit criteria**
- Identical behaviour on iPad and laptop, verified against the same golden fixtures.

---

## Effort summary

| Sprint | Focus | Points | Calendar |
|---|---|---|---|
| 0 | Hardware spike | 6 | 1–2 days |
| 1 | Walking skeleton | 34 | ~1 week |
| 2 | Child's loop | 60 | ~2 weeks |
| 3 | Adult's loop | 39 | ~2 weeks |
| 4 | Duet & dashboard | 35 | ~2 weeks |
| 5 | iPad (optional) | 16 | ~1 week |
| | **v1 total (0–4)** | **174** | **~7 weeks** |

Points are load-bearing only *within* a sprint; the calendar estimates assume
part-time evening work, which is the realistic mode for this project.

---

## Coverage check

Every `M`-priority functional requirement is delivered by at least one story:

| FR | Sprint | FR | Sprint |
|---|---|---|---|
| FR-EXP-001 | 2 | FR-DUO-003 | 4 |
| FR-EXP-002 | 1 | FR-PRO-001 | 2 |
| FR-EXP-003 | 1 | FR-PRO-002 | 2 |
| FR-EXP-004 | 2 | FR-PRO-003 | 1 |
| FR-EXP-007 | 1, 2 | FR-CON-001 | 2 |
| FR-STU-001 | 3 | FR-CON-002 | 2 |
| FR-STU-002 | 3 | FR-CON-003 | 2 |
| FR-STU-003 | 3 | FR-CON-004 | 2 |
| FR-STU-004 | 3 | FR-SYN-001 | 1, 2 |
| FR-STU-005 | 3 | FR-SYN-002 | 2 |
| FR-STU-008 | 3 | FR-SYN-003 | 2 |
| FR-DUO-001 | 4 | FR-SYN-005 | 2 |
| FR-DUO-002 | 4 | FR-SYS-001 | 0, 1 |
| FR-SYS-002 | 0, 1 | FR-SYS-003 | 1 |
| FR-SYS-004 | 4 | FR-SYS-005 | 4 |
| FR-SYS-007 | 1–4 (ongoing) | FR-SYS-008 | 2 |
