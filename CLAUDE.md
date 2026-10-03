# CLAUDE.md — DuoKeys ground rules

This file is read at the start of every session. It is the contract for how work
happens in this repo. Where it conflicts with a general instinct, this file wins.

**DuoKeys** is a local-first web app that connects to a digital piano over USB
MIDI so a six-year-old and an adult can learn together — a game for the child
(Explorer), a practice tool for the adult (Studio), and four-hands duets at the
same instrument. Target platform is a desktop browser (`ADR-001`); the iPad path
is kept open but not built (`ADR-002`).

---

## 1. The documentation gate

> Documentation drift is not an accident that happens to a project. It is the
> default state of a project that does not enforce anything. This section is the
> enforcement.

### The rule

**At the end of every section of work — a user story, a sprint, a bug fix, a
refactor, an architectural change — before the work is called done, run the
impact matrix in § 1.2 and update every file it names.**

"Section of work" means whatever you were about to report as finished. If you are
about to write "done", the matrix runs first.

Two hard sub-rules, because these are the ones that quietly rot:

1. **The HTML renderings are not optional.** `docs/html/*.html` is a rendering of
   the Markdown, not a separate artefact with its own life. A Markdown change
   without the matching HTML change is an unfinished change, not a partial one.
2. **Name the files you touched, in the completion message.** Not "docs updated" —
   the actual list. If a file the matrix names was deliberately *not* touched, say
   which and why, in the same message. Silence is the failure mode being guarded
   against.

### 1.2 Impact matrix — what a change obliges you to update

Find the row for what you changed. Update **every** file in the right-hand column.
No row is "usually fine to skip".

| If you change… | You must also update |
|---|---|
| **An `ADR-*`** — add, revise, supersede | `docs/01-TECHNICAL-ARCHITECTURE.md` § 0 · `docs/html/architecture.html` (its `.req` block, `id="ADR-nnn"`) · `docs/00-INDEX.md` (ADR summary list) · the Build Board artifact, Decisions tab |
| **A `TA-*-*` component** — add, rename, change behaviour | `docs/01-TECHNICAL-ARCHITECTURE.md` · `docs/html/architecture.html` (heading with `id="TA-XXX-nnn"` and `<span class="aid">`) · `docs/00-INDEX.md` traceability matrix · `docs/04-TEST-SCENARIOS.md` if the testable behaviour moved · the Build Board artifact |
| **An `NFR-*` or `RISK-*`** | `docs/01-TECHNICAL-ARCHITECTURE.md` §§ 12–13 · `docs/html/architecture.html` (the `<tr id="NFR-nnn">` / `<tr id="RISK-nnn">`) · the Build Board artifact |
| **An `FR-*`** — add, remove, re-prioritise, re-scope | `docs/02-FUNCTIONAL-SPECIFICATION.md` **including the § 8 count table** · `docs/html/functional.html` (its `.req` block **and** the § 8 summary table **and** the module count table at the top) · `docs/00-INDEX.md` matrix · `docs/03-SPRINT-PLAN.md` coverage check (if `M`-priority) · `docs/html/sprints.html` coverage table · `docs/04-TEST-SCENARIOS.md` · the Build Board artifact, Requirements tab |
| **A `US-*`** — add, split, re-point, re-estimate | `docs/03-SPRINT-PLAN.md` **including the effort summary table** · `docs/html/sprints.html` (the `<tr id="US-s.nn">`, the sprint's `.du` point total, the effort summary, the sidebar and `.stats` counts) · `docs/00-INDEX.md` "Delivered in" column · the Build Board artifact, Sprints tab |
| **A `TS-*`** | `docs/04-TEST-SCENARIOS.md` · `docs/00-INDEX.md` "Verified by" column · the Build Board artifact, Tests tab |
| **A `PRE-*`, the Definition of Done, a convention, the repo scaffold** | `docs/05-ENGINEERING-HANDBOOK.md` · the Build Board artifact, Overview tab |
| **A tolerance, grading or timing constant** (`TOLERANCE`, star thresholds, velocity floor, chord-group ticks, EMA α, look-ahead) | the code · the golden fixtures that assert against it · `docs/01-TECHNICAL-ARCHITECTURE.md` (`TA-MAT-006`, `TA-GRD-002`, `TA-MAT-004`, `TA-MAT-005`, `TA-CLK-003`, `TA-CLK-005`) · `docs/html/architecture.html` · `docs/04-TEST-SCENARIOS.md` |
| **The port interfaces** (`adapters/ports.ts`) | the code · `docs/01-TECHNICAL-ARCHITECTURE.md` `TA-PORT-002` (the TypeScript block is copied verbatim — keep it verbatim) · `docs/html/architecture.html` `TA-PORT-002` `<pre>` · `TA-PORT-003` adapter table if an adapter appeared |
| **The visual design of the doc set** | `docs/html/_doc.css` **only** — never the four content pages individually |
| **The behaviour of the doc set** (TOC, filter, ID linkification, theme) | `docs/html/_doc.js` **only**. If a new ID family appears, add it to the `TARGET` map — see § 1.4 |
| **Adding an HTML rendering of a doc that has none** | the new `docs/html/*.html` · `_doc.js` `TARGET` map · `scripts/docs-check.mjs` `PAIRS` list · `docs/html/index.html` card · the `.switch` nav in **all** pages in `docs/html/` |
| **Sprint 0 findings** (after running the spike) | `docs/sprint-0-findings.md` (new) · `docs/00-INDEX.md` open questions · `docs/01-TECHNICAL-ARCHITECTURE.md` `TA-CLK-004` if the measured latency changes the approach · `RISK-001` status |

### 1.3 The mechanical check

The matrix is a discipline; this is the part that cannot be forgotten.

```bash
node scripts/docs-check.mjs
```

It asserts that every ID defined in a Markdown document is anchorable in its HTML
rendering, and that no HTML page invents an ID the Markdown does not define. It
exits non-zero on drift and prints exactly which IDs are on which side.

- **Run it before reporting any documentation change as done.** Always.
- Wire it into CI and into `npm run docs:check` as part of `US-1.01`. Until the
  repo exists, run it by hand.
- It catches *structural* drift — a requirement added to one half and not the
  other. It cannot catch a paragraph edited in one half only. That is what § 1.2
  and naming your files are for.

### 1.4 Standing decisions about the doc set

- `TS-*` and `PRE-*` are **deliberately unlinked** in `_doc.js`'s `TARGET` map,
  because `04-TEST-SCENARIOS.md` and `05-ENGINEERING-HANDBOOK.md` have no HTML
  rendering. Linking them would produce dead links. If either gets a page, add it
  to `TARGET`, to `PAIRS` in `docs-check.mjs`, and to the `.switch` nav everywhere.
- IDs are **never reused and never renumbered.** A retired requirement gets a
  `Withdrawn` status line, not a deletion — every `US-*` and `TS-*` pointing at it
  would otherwise dangle silently.
- Every ID in prose is auto-linkified at page load. **Do not hand-author
  `<a href="#TA-...">` links** — write the bare ID in the text and let `_doc.js`
  do it. Hand-authored links rot; a regex over the ID scheme cannot.
- The four HTML pages share `_doc.css` and `_doc.js` by relative path so the set
  works from `file://` with no server. Keep it that way.

### 1.5 Artifacts

| Artifact | URL | Status |
|---|---|---|
| **DuoKeys Build Board** | `https://claude.ai/code/artifact/6a574200-c6ab-47c9-9a79-f1b46c436f5b` | **Live.** Republish on any change the matrix routes to it. |
| DuoKeys Build Architecture | `https://claude.ai/code/artifact/9a4f8537-b30f-4e37-b5dd-1d869d7f80f5` | **Frozen.** The narrative record of how the decisions were reached. Superseded by `docs/`. Do not overwrite. |
| **DuoKeys Design Reference** | `https://claude.ai/code/artifact/90b71da2-2e2f-4613-bd24-a338ebb52a08` | **Live.** Eight annotated screen mockups (Explorer + Studio) plus the logo lockups — the visual identity `TA-APP-006` specifies in code. Republish on any change to the design system. |

To update the Build Board: read it first (`action: "read"` with its URL), merge
onto what comes back, then publish to the same URL. Never publish without the
`url` — that creates a second artifact and orphans the link.

---

## 2. Architecture rules

These are load-bearing. Breaking one is a decision, not a shortcut.

1. **Dependencies point inward only.** `runtime/` → `ui/` / `adapters/` → `core/`.
   `core/` imports nothing but `core/`. (`TA-PORT-001`)
2. **`core/` is pure.** No React, no DOM, no `navigator`, no `window`, no
   IndexedDB, no Supabase, no Tone.js. Also no `Date.now()`, no `Math.random()`,
   no `performance.now()` — time and randomness are **injected**, so every test is
   deterministic. (`ADR-005`)
3. **Every platform capability enters through one of the five ports.** If you find
   yourself reaching for a browser API outside `adapters/`, the answer is a port
   method, not an exception. (`TA-PORT-002`)
4. **The boundary lint rule is not advisory.** It fails CI. Do not disable it, do
   not add an `eslint-disable` for it. It is the only thing keeping the iPad path
   open. (`TA-PORT-005`, `RISK-007`)
5. **The audio clock is master.** Never grade against `performance.now()`
   directly; convert through `MasterClock`. (`ADR-006`)
6. **Never mix time domains implicitly.** `Millis`, `Seconds`, `Ticks` are branded
   types for exactly this reason. If you are writing a bare `number` for a time
   value, stop. (`TA-CLK-001`)
7. **IndexedDB is the truth; Supabase is additive.** No practice feature may have
   a network read on its path. (`ADR-003`)
8. **Attempts are append-only and immutable.** This is what makes sync
   conflict-free. Do not add an update path to `attempts`. (`TA-DAT-002`)

---

## 3. Code rules

- TypeScript `strict`, plus `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. **No `any`** — `unknown` and narrow.
- Name units in the identifier: `deltaMs`, `startTick`, `offsetSeconds`. Booleans
  read as assertions: `isSustaining`, `hasPedal`.
- Branch: `us-2.13-note-ninja`. Commit: `US-2.13: response-time bands for Note Ninja`.
- CI order: `typecheck` → `lint` → `test:unit` → `docs:check` → `build` → `test:e2e`.
- The full Definition of Done is in `docs/05-ENGINEERING-HANDBOOK.md`. It now
  includes the documentation clause from § 1 — a story is not done until the
  matrix has been run.

---

## 4. Product rules

These come from who this is for, and they are easy to erode one small decision at
a time.

- **There is no failure state for the child.** Wait mode has no timer and no
  timeout. Any completed attempt earns at least one star. Errors are phrased
  "try this one again", never as a deduction. (`FR-EXP-003`, `FR-EXP-007`)
- **No dark patterns.** No streak-loss anxiety, no artificial scarcity, no
  currency. (`NFR-012`)
- **Colour is never the only signal.** (`NFR-008`)
- **The child reads simple words**, so short labels are fine — but icons, colour,
  animation and audio still carry the interface.
- **Privacy:** first names only, no child email, no third-party analytics, no
  audio ever leaves the device. (`NFR-010`, `FR-SYS-008`)
- **Every piece of content needs a licence entry** with a source URL and a
  verification date, or the build fails. (`TA-CNT-005`)

---

## 5. Working rules

- **Sprint 0 gates everything.** Until `docs/sprint-0-findings.md` exists with a
  measured latency, no repo scaffold, no framework, no first story. Run
  `sprint-0-spike.html` at the piano. If the calibrated median is above ~80 ms and
  cannot be reduced, **stop and reconsider** — that is a real outcome, not a
  formality. (`RISK-001`)
- **Sprint 3 is gated on Sprint 2's exit criteria actually being met.** The adult
  module is the most tempting place to hide from a child's-loop problem.
  (`RISK-005`)
- **Vertical slices.** Every sprint ends with something playable at the piano, not
  with a completed layer.
- **Expect to discard a designed feature after Sprint 2.** If nothing is
  discarded, the week of observation was not honest.
- When a decision here turns out to be wrong, **write a new ADR superseding the
  old one.** Do not edit the old ADR's decision to match reality — the record of
  having changed your mind is the useful part.

---

## 6. Before you say "done"

```
[ ] Tests pass, typecheck clean, lint clean
[ ] node scripts/docs-check.mjs   → passed
[ ] Impact matrix (§ 1.2) run for every row that applies
[ ] docs/html/*.html updated alongside their Markdown source
[ ] Build Board artifact republished if the matrix routed there
[ ] Completion message NAMES every file touched, and every matrix file
    deliberately skipped, with the reason
```
