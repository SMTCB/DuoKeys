# DuoKeys — Test Scenarios

**Document ID:** TEST
**Version:** 1.0
**Date:** 2 September 2026
**References:** [01-TECHNICAL-ARCHITECTURE.md](01-TECHNICAL-ARCHITECTURE.md) ·
[02-FUNCTIONAL-SPECIFICATION.md](02-FUNCTIONAL-SPECIFICATION.md) ·
[03-SPRINT-PLAN.md](03-SPRINT-PLAN.md)

---

## Testing strategy

The payoff for the pure core (ADR-005) is that CI has no MIDI device, no audio
hardware and no six-year-old, and needs none of them. Roughly 80% of the risk in
this product lives in `core/`, which is 100% testable in node.

| Tier | ID prefix | Runner | Hardware | Runs |
|---|---|---|---|---|
| Unit — pure core | `TS-U-*` | Vitest (node) | none | every commit |
| Integration — adapters + core | `TS-I-*` | Vitest (jsdom / fake backends) | none | every commit |
| Golden fixtures — recorded performances | `TS-G-*` | Vitest | none | every commit |
| End-to-end — full app | `TS-E-*` | Playwright | none (mock MIDI) | pre-merge |
| Manual — hardware and human | `TS-M-*` | human at the piano | **yes** | per sprint exit |

### Fixture strategy

A `PerformanceFixture` is a recorded or hand-authored stream of `RawMidiMessage`
with timestamps, replayed by `FakeMidiBackend` against a `FakeClock`. Fixtures are
captured from real sessions in Sprint 0–1 and checked into the repo. This is what
makes `TS-G-*` possible and what stops matcher tuning from silently regressing
grading.

### Coverage targets

| Area | Target | Rationale |
|---|---|---|
| `core/clock` | 100% branch | Silent drift is undebuggable in production |
| `core/matcher` | 100% branch | The correctness heart of the product |
| `core/grading` | 100% branch | Wrong stars destroy a child's trust in the app |
| `core/content` | 95% | Build-time, so failures are loud |
| `adapters/` | 70% | Thin by design; e2e covers the rest |
| `ui/` | smoke only | Presentational, changes constantly |

---

## 1. Clock — `TS-U-CLK-*`

| ID | Scenario | Given / When / Then | Verifies |
|---|---|---|---|
| `TS-U-CLK-001` | Tick↔second conversion round-trips | Given a 120 bpm constant tempo map, when converting 480 ticks to seconds and back, then the result equals 480 ticks exactly | TA-CLK-001 |
| `TS-U-CLK-002` | Tempo changes are honoured | Given a map with 120 bpm for 4 bars then 60 bpm, when converting a tick in bar 6, then the elapsed seconds reflect both segments | TA-CLK-002 |
| `TS-U-CLK-003` | Tempo scaling is applied | Given tempo scale 0.5, when converting ticks to audio time, then durations double | FR-STU-004 |
| `TS-U-CLK-004` | EMA converges on a constant offset | Given a fake audio clock offset by a fixed 12 ms, when 50 events are observed, then `wallToAudio` is within 0.5 ms of truth | TA-CLK-003 |
| `TS-U-CLK-005` | EMA rejects a single outlier | Given a converged EMA, when one event arrives 200 ms out, then the correction shifts by less than 10 ms | TA-CLK-003 |
| `TS-U-CLK-006` | Drift over a long session stays bounded | Given clocks drifting at 1 ms/minute, when 30 simulated minutes elapse, then correction error stays under 5 ms | TA-CLK-003, RISK-001 |
| `TS-U-CLK-007` | Calibration uses median not mean | Given 16 taps of which one is 400 ms late, when computing the offset, then the result is unaffected by the outlier | TA-CLK-004 |
| `TS-U-CLK-008` | Calibration rejects too few samples | Given fewer than 8 usable taps, when computing, then calibration reports failure rather than a bad number | TA-CLK-004 |
| `TS-U-CLK-009` | Branded types prevent domain mixing | Given `Millis` and `Seconds`, when mixed without conversion, then it is a compile error | TA-CLK-001 |
| `TS-U-CLK-010` | Pause and resume do not advance musical time | Given a running clock, when paused for 5 s and resumed, then tick position is unchanged | TA-CLK-002 |
| `TS-U-CLK-011` | `checkLoop` snaps back at the loop end | Given `setLoop(0, 480)` at 120 bpm, when audio time advances 0.5 s, then `checkLoop()` returns true and position is back at tick 0 | TA-CLK-002, FR-STU-003 |
| `TS-U-CLK-012` | `checkLoop` is a no-op with no loop set, or while paused | Given no loop set (or a set loop while paused), when time advances past where a loop end would be, then `checkLoop()` returns false | TA-CLK-002, FR-STU-003 |
| `TS-U-CLK-013` | `clearLoop` removes the loop range | Given a loop set, when `clearLoop()` is called, then `loopRange` is undefined and `checkLoop()` returns false even past the old loop end | TA-CLK-002, FR-STU-003 |
| `TS-U-CLK-014` | `setLoop` rejects a non-forward range | Given a loop end at or before the loop start, when `setLoop` is called, then it throws | TA-CLK-002, FR-STU-003 |
| `TS-U-CLK-015` | A held clock stands still and resumes where it stopped | Given a running clock held at tick 480, when audio time advances 2 s then `resume()` is called, then the tick position is still 480 at resume and moves on afterwards | TA-CLK-002, FR-STU-015 |

---

## 2. MIDI pipeline — `TS-U-MID-*`

| ID | Scenario | Given / When / Then | Verifies |
|---|---|---|---|
| `TS-U-MID-001` | Note on decoded | Given `0x90 3C 64`, then a NoteOn at pitch 60 velocity 100 | TA-MID-002 |
| `TS-U-MID-002` | Note off decoded | Given `0x80 3C 40`, then a NoteOff at pitch 60 | TA-MID-002 |
| `TS-U-MID-003` | **Velocity-0 note-on is a note-off** | Given `0x90 3C 00`, then a NoteOff, not a NoteOn | TA-MID-002 |
| `TS-U-MID-004` | Active sensing is swallowed | Given 100 × `0xFE`, then zero events are emitted | TA-MID-002 |
| `TS-U-MID-005` | CC64 threshold | Given CC64 value 63 then 64, then pedal reads up then down | TA-MID-004 |
| `TS-U-MID-006` | Running status handled | Given a running-status stream, then all notes decode correctly | TA-MID-002 |
| `TS-U-MID-007` | Unknown message ignored safely | Given a SysEx or unhandled status byte, then no crash and no event | TA-MID-002 |
| `TS-U-MID-008` | Latency offset applied | Given `latencyOffsetMs` of 30, when an event arrives at t, then the graded timestamp is t − 30 | TA-CLK-004 |
| `TS-U-MID-009` | Note-on/off paired into duration | Given on at 0 ms and off at 250 ms, then one NoteEvent of 250 ms | TA-MID-001 |
| `TS-U-MID-010` | Unmatched note-off ignored | Given a note-off with no preceding note-on, then no crash and no event | TA-MID-001 |
| `TS-U-MID-011` | Repeated note-on without note-off | Given two note-ons for the same pitch, then the first is closed and a new one opens | TA-MID-001 |

### PedalTracker — `TS-U-PED-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-PED-001` | Key released with pedal up → `keyUp: true, stoppedSounding: true` | TA-MID-004 |
| `TS-U-PED-002` | Key released with pedal down → `keyUp: true, stoppedSounding: false` | TA-MID-004 |
| `TS-U-PED-003` | Pedal up after sustained release → note-off emitted for each sustained pitch | TA-MID-004 |
| `TS-U-PED-004` | Note re-pressed while sustained → moves back to held, not double-counted | TA-MID-004 |
| `TS-U-PED-005` | Pedal down with no notes held → no events, no error | TA-MID-004 |
| `TS-U-PED-006` | Half-pedal (CC64 = 64 exactly) treated as down | TA-MID-004 |

---

## 3. Matcher — `TS-U-MAT-*`

### Wait mode

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-MAT-001` | Correct single note advances the stream | TA-MAT-002, FR-EXP-003 |
| `TS-U-MAT-002` | Wrong note does not advance and does not fail the attempt | TA-MAT-002 |
| `TS-U-MAT-003` | Three-note chord advances only when all three are down | TA-MAT-002, TA-MAT-004 |
| `TS-U-MAT-004` | Chord notes arriving 500 ms apart still count as one group | TA-MAT-004 |
| `TS-U-MAT-005` | **No timeout ever fires** — 60 s of silence leaves state unchanged | FR-EXP-003 |
| `TS-U-MAT-006` | Extra notes are reported but never block advancement | TA-MAT-002 |
| `TS-U-MAT-007` | Notes below velocity 12 are ignored | TA-MAT-005 |
| `TS-U-MAT-008` | Reset returns the matcher to the first group | TA-MAT-001 |

### Timed mode

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-MAT-010` | Note within `perfect` window scores perfect | TA-MAT-003, TA-MAT-006 |
| `TS-U-MAT-011` | Note within `good` but outside `perfect` scores good | TA-MAT-006 |
| `TS-U-MAT-012` | Note outside `loose` counts as extra, and the expected note as missed | TA-MAT-003 |
| `TS-U-MAT-013` | **Monotonic constraint** — a late note cannot match an expected slot earlier than one already matched | TA-MAT-003 |
| `TS-U-MAT-014` | Greedy nearest-match picks the closer of two candidate expectations | TA-MAT-003 |
| `TS-U-MAT-015` | Expected note past its window is reported missed exactly once | TA-MAT-003 |
| `TS-U-MAT-016` | Tolerance at 60 bpm is wider than at 160 bpm | TA-MAT-006, ADR-007 |
| `TS-U-MAT-017` | Tolerance never drops below the absolute floor at very high tempo | TA-MAT-006 |
| `TS-U-MAT-018` | `toleranceScale` 1.6 widens all windows proportionally | FR-EXP-007 |
| `TS-U-MAT-019` | Octave error is classified `octave`, not `other` | TA-MAT-001 |
| `TS-U-MAT-020` | Semitone error is classified `neighbour` | TA-MAT-001 |
| `TS-U-MAT-021` | Two matcher instances fed disjoint pitch ranges do not interfere | FR-DUO-002 |
| `TS-U-MAT-022` | A nearer wrong-pitch slot never steals the match from a same-pitch slot still in window | TA-MAT-003 |

### Chord matching

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-MAT-023` | Playing all of a chord's pitch classes, in any octave, resolves `complete` | TA-MAT-007 |
| `TS-U-MAT-024` | A played set missing one pitch class stays `partial`, never `wrong` | TA-MAT-007 |
| `TS-U-MAT-025` | Extra non-chord notes accumulate but never block `complete` | TA-MAT-007 |
| `TS-U-MAT-026` | `WaitMatcher` with `anyOctave` counts the wanted letter in any octave (nearest wanted pitch), needs two presses for a doubled letter, still reports another letter as extra, and stays exact by default | TA-MAT-002, FR-STU-015 |

---

## 4. Grading — `TS-U-GRD-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-GRD-001` | Perfect performance → accuracy 1.0, completion 1.0, 3 stars | TA-GRD-002 |
| `TS-U-GRD-002` | 90% accuracy, full completion → 2 stars | TA-GRD-002 |
| `TS-U-GRD-003` | 70% completion → 1 star | TA-GRD-002 |
| `TS-U-GRD-004` | 40% completion → 0 stars | TA-GRD-002 |
| `TS-U-GRD-005` | **Explorer floor** — completed attempt with 50% accuracy still yields ≥ 1 star | FR-EXP-007 |
| `TS-U-GRD-006` | Consistently 40 ms early → `rushDragMs` = −40, signed | TA-GRD-001, FR-STU-008 |
| `TS-U-GRD-007` | Alternating ±40 ms → `rushDragMs` ≈ 0 but `timingRmsMs` ≈ 40 | TA-GRD-001 |
| `TS-U-GRD-008` | Perfectly even intervals → `evennessCv` = 0 | TA-GRD-003 |
| `TS-U-GRD-009` | Lumpy intervals → `evennessCv` > 0.20 | TA-GRD-003, FR-STU-007 |
| `TS-U-GRD-010` | Per-measure aggregation attributes errors to the correct bar | TA-GRD-004, FR-STU-009 |
| `TS-U-GRD-011` | Empty attempt (no notes played) grades 0 without dividing by zero | TA-GRD-001 |
| `TS-U-GRD-012` | Grade is deterministic — same fixture, same grade, every run | TA-GRD-001 |
| `TS-U-GRD-013` | Note Ninja response classifies < 2s fast, 2–6s correct (both boundaries inclusive), > 6s hinted | TA-GRD-005, FR-EXP-005 |
| `TS-U-GRD-014` | Note Ninja card draw never repeats the immediately-previous card, deterministic under an injected random source | TA-GRD-005 |
| `TS-U-GRD-015` | **Universal star floor** — `completion = 0.4` with `explorerFloor: true` still yields ≥ 1 star (the case a `completion === 1` fixture couldn't catch) | FR-EXP-007 |
| `TS-U-GRD-016` | `reviewCard('fast')` advances the box by one, capped at box 5 | TA-DAT-006 |
| `TS-U-GRD-017` | `reviewCard('wrong')` resets the box to 1 and `dueAtMs` follows `INTERVAL_BY_BOX` from the new box | TA-DAT-006 |
| `TS-U-GRD-018` | `describeRushDrag` phrases a signed offset directionally — negative "ahead of the beat", positive "behind the beat", zero "right on the beat" | TA-GRD-001, FR-STU-008 |
| `TS-U-GRD-019` | `describeRushDrag` rounds fractional milliseconds before phrasing | TA-GRD-001, FR-STU-008 |
| `TS-U-GRD-020` | `classifyArticulation` returns `'short'`/`'even'`/`'long'` for actual/target ratios below `SHORT_RATIO`, within tolerance, and above `LONG_RATIO` respectively; `describeArticulation` summarises a `Grade`'s classified notes into a directional sentence | TA-GRD-006, FR-STU-006 |
| `TS-U-GRD-021` | `classifyArticulation` returns `undefined` for a target duration ≤ 0 (unclassifiable); `describeArticulation` omits unclassified notes and returns `undefined` when none were classified | TA-GRD-006, FR-STU-006 |

---

## 5. Content pipeline — `TS-U-CNT-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-CNT-001` | MusicXML parses to notes with correct pitch, start and duration | TA-CNT-001 |
| `TS-U-CNT-002` | Ties are merged into a single note | TA-CNT-001 |
| `TS-U-CNT-003` | Grace notes are resolved, not dropped | TA-CNT-001 |
| `TS-U-CNT-004` | Output is normalised to 480 PPQ regardless of source division | TA-CNT-001 |
| `TS-U-CNT-005` | Notes within 30 ticks share a `groupId` | TA-MAT-004 |
| `TS-U-CNT-006` | Notes 31 ticks apart get different `groupId`s | TA-MAT-004 |
| `TS-U-CNT-007` | Sections split on phrase boundaries where present | FR-CON-003 |
| `TS-U-CNT-008` | Sections fall back to 2 bars where no phrase marks exist | FR-CON-003 |
| `TS-U-CNT-009` | **Missing licence entry exits non-zero** | TA-CNT-005, FR-CON-004 |
| `TS-U-CNT-010` | Licence entry without a verification date fails the build | TA-CNT-005 |
| `TS-U-CNT-011` | Difficulty sub-scores are published in the output JSON | TA-CNT-002 |
| `TS-U-CNT-012` | A five-finger middle-C tune scores difficulty 1 | TA-CNT-003, ADR-008 |
| `TS-U-CNT-013` | A grand-staff piece with accidentals scores 4 or above | TA-CNT-003 |
| `TS-U-CNT-014` | Part→hand mapping assigns treble/bass staves correctly | TA-CNT-001 |
| `TS-U-CNT-015` | Malformed MusicXML fails with a message naming the file | TA-CNT-001 |
| `TS-U-CNT-016` | A note starting exactly on a section's `endTick` belongs to the next section, not this one (half-open range) | TA-DAT-001 |
| `TS-U-CNT-017` | An arrangement's quest sections partition its full tick range with no gaps or overlaps, and its one reward section spans the whole piece | TA-DAT-001, FR-EXP-004 |
| `TS-U-CNT-018` | Scientific pitch names (`"C4"`, `"C#4"`/`"Db4"`, octave boundaries) resolve to the correct MIDI pitch, and malformed names throw | TA-CNT-001 |
| `TS-U-CNT-019` | `ingestChords` reads a curated MIDI subset and emits `ChordEntry`/`ProgressionEntry` shapes with correct `root`/`quality`/`midiNotes` — progression sequences ported as text from `free-midi-chords` | TA-CNT-006 |
| `TS-U-CNT-020` | `generateHanonArrangement` sequences a pattern's cell up a major scale by degree and back down, right and left hand an octave apart, every note the pattern's fixed duration, deterministically | TA-CNT-004, FR-STU-007 |
| `TS-U-CNT-021` | `generateSightReadingArrangement` produces a diatonic, pitch-range- and rhythmic-vocabulary-constrained phrase filling exactly the requested bars, deterministic under a repeatable random source and different under a different one | TA-CNT-004, FR-STU-010 |
| `TS-U-CNT-022` | Chord text parses as symbols (`Dm7`, `Bb/D`, `C#m7b5`) or as Roman numerals in a key and mode (`I V vi IV`, `bVII`, `ii7`), including dash-joined `I-V-vi-IV`; every bad token is reported, not just the first; chord ids round-trip to symbols | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-023` | `makeUserProgression` names an unnamed progression from its symbols, rejects empty or unparseable text with a readable message, and `userProgressionsOf` tolerates malformed saved data | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-024` | `progressionToArrangement` gives each chord four beats as one chord-group, a symbol marker at each chord's tick, and a stable `chords:<id>` arrangement id | TA-REN-001, FR-STU-015 |
| `TS-U-CNT-025` | The catalogue holds 40 qualities × 12 roots = 480 chords and 191 progressions per key (2,292 in all, ids unique, modal repeats suffixed `~2`); every modal chord id exists; `C-modal:I-bIIIM-bVIIM-IV` is C, D#, A#, F; a bare `7` and the diminished degree read diatonically only without an accidental | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-026` | `parseSmf` reads notes (start, length, velocity, channel), running status, velocity-0 note-offs, tempo, time signature and track names; skips sysex and controllers; closes unclosed notes; reports malformed, truncated and SMPTE files as an error value instead of throwing | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-027` | `styledProgressionToArrangement` keeps the style file's tempo, one marker per chord per pass, simultaneous notes in one group on the PPQ grid, transposes by the key offset (folded to −6…+5), declines an empty file; `styleFilePath` names a bundled file for every non-blues progression in every style | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-028` | `searchSongs` finds a piece by any words of its title, composer, opus or style, ignoring accents and punctuation ("etude" finds "Étude"), needs every word, and filters by style; `smfToArrangement` reads two note tracks as right then left hand and a single track split at middle C, adds a both-hands track, groups notes that begin together across the hands, scales the file's ticks to 480 PPQ and keeps its tempo, declines a file with no notes; `isMonophonic` says whether a track is a single line | TA-CNT-006, FR-STU-016 |
| `TS-U-CNT-029` | Every Mutopia MIDI file in `content/sources/mutopia/mid` parses with `parseSmf` and converts to a non-empty arrangement (skipped when the mirror is absent) | TA-CNT-006, TA-CNT-005, FR-STU-016 |
| `TS-U-CNT-030` | `parseChordChart` keeps chord lines, skips lyric lines and notes the sections | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-031` | `parseChordChart` reports chord-shaped tokens it cannot read | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-032` | `chartToArrangement` builds one bar per chord and carries the chart sections | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-033` | `chartToArrangement` returns nothing for a chart with no chords | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-034` | `makeCustomSong` rejects a nameless song and a chordless chart | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-035` | A chart round-trips through `makeCustomSong` and `customSongToArrangement` | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-036` | `isEasyProgression` accepts few plain chords and rejects many or unusual ones | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-037` | `pickFreePlay` only suggests easy progressions, narrowed by mood | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-038` | `pickFreePlay` falls back to the whole easy pool when the mood has none | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-039` | `pickFreePlay` avoids repeating the last pick when it can | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-040` | `pickFreePlay` is deterministic for a given draw and returns nothing for an empty pool | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-041` | `easyMoods` lists the moods of easy progressions only | TA-CNT-007, FR-STU-018 |
| `TS-U-CNT-046` | `songLevel` bands a piece from its notes per bar, and `searchSongs` filters by that level | TA-CNT-004, FR-STU-016 |
| `TS-U-CNT-047` | `mxlToMusicXml` reads stored and deflated `.mxl` archives, follows `container.xml`, and refuses a non-zip | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-048` | `parseMusicXml` places several voices on one staff by time (absolute `atTick`), keeps a one-voice staff sequential, and an overrunning bar does not move the next bar | TA-CNT-001, FR-STU-017 |
| `TS-U-CNT-049` | `parseMusicXmlWithReport` lists overlong and short bars and whether a tempo was found; `withTempo` writes a clamped tempo | TA-CNT-001, FR-STU-017 |
| `TS-U-CNT-050` | `omrClient` reports "not running" without throwing, posts the file under its name, unzips the result and turns a refusal into a plain message | TA-CNT-007, FR-STU-017 |
| `TS-U-CNT-051` | `detectKey` finds G major and A minor from short tunes, says nothing about a handful of notes and spells flat keys with flats; `transposeArrangement` moves every note without touching the original and `transposeLimits` stops at the keyboard edges | TA-REN-003, FR-STU-016 |
| `TS-U-SYN-010` | A household name becomes, and a PIN is padded to a 6+ character password, one stable mail-proof address (case and spaces ignored) and is shown back plainly | TA-SYN-002, FR-SYN-001 |
| `TS-U-PRO-010` | A family PIN is exactly four digits, is read off settings (malformed ignored), and a member with no PIN lets anyone in | FR-PRO-001 |
| `TS-U-CNT-052` | `layoutScore` puts E4 and G2 on the bottom lines, spells black keys as asked, spaces notes by time, splits hands at middle C and lists the played track's groups in matcher order | TA-REN-003, FR-STU-016 |
| `TS-U-CNT-045` | `pickFreePlay` stays in a chosen key, and `sameProgressionInKey` finds the same degrees in another key and nothing for a typed-in progression | TA-CNT-007, FR-STU-015, FR-STU-018 |
| `TS-U-CNT-044` | A styled progression puts each chord marker on notes of that chord even when the chords are not evenly spaced in the file (`I-IV-V`) | TA-CNT-006, FR-STU-015 |
| `TS-U-CNT-043` | `progressionPosition` reports the chord and round of the group being played, stays on the last group past the end, and is undefined with no markers | FR-STU-015 |
| `TS-U-CNT-042` | `chordsToMusicXml` writes one whole-note measure per chord group on a two-stave part, puts notes at or above 60 on the treble and the rest on the bass, and carries the chord symbol | TA-REN-003, FR-STU-015 |

`TS-U-CNT-019` is **partially** satisfied as written — `ingestChords.ts`
(`US-3.13`) emits the same `ChordEntry`/`ProgressionEntry` shapes.
`midiNotes` (chord voicings) still come from this codebase's own
chord-interval formulas and diatonic harmony
(`src/core/content/chordCatalogue.ts`), not from a curated MIDI subset —
the binary SMF reader that now exists (`parseSmf`, `TS-U-CNT-026`) is not used for
chord voicings, which stay generated. Progression *sequences* and mood tags, however, genuinely are ported
as text data from `ldrolez/free-midi-chords` (`chords.py`'s `prog_maj`/
`prog_min` Roman-numeral token lists, MIT, explicit user authorization
2026-09-04) — see `src/core/content/progressionData.ts` and the
`free-midi-chords-progressions` licence entry. The generator's own
correctness (now 480 chords and 2,292 progressions — see `TS-U-CNT-025` — correct
`root`/`quality`/`midiNotes` per formula, correct progression transposition
and mood-tag passthrough per ported template) is covered instead, by
`src/core/content/chordCatalogue.test.ts`. The ID stays open, not renumbered
or withdrawn, until the chord voicings themselves are sourced from real
MIDI content.

`TS-U-CNT-002` is satisfied by `parseMusicXml.ts` (`US-3.12`): a `<tie
type="stop">` merges into the immediately preceding same-pitch note rather
than becoming a second onset (`src/core/content/parseMusicXml.test.ts`).
`TS-U-CNT-003` is **not** satisfied as written — `parseMusicXml.ts` throws a
named error on a grace note rather than resolving it. This is a deliberate,
documented scope limit for `US-3.12` (grace notes carry no `<duration>` and
require borrowing time from an adjacent note, a materially harder problem
than tie-merging), not an oversight. The ID stays open rather than being
renumbered or withdrawn, per this repo's ID-stability convention, until
grace-note resolution is scoped as its own story.

---

## 6. Progression — `TS-U-PRO-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-PRO-001` | With no attempts, only the first quest section is unlocked | FR-PRO-002 |
| `TS-U-PRO-002` | A quest section unlocks once the previous quest's best attempt earns ≥ 1 star | FR-PRO-002, FR-EXP-007 |
| `TS-U-PRO-003` | The reward section stays locked until every quest section has ≥ 1 star, then unlocks | FR-PRO-002, FR-EXP-004 |
| `TS-U-PRO-004` | `bestStars` for a section is the maximum `grade.stars` across all attempts for that section, not the most recent | FR-PRO-002 |
| `TS-U-PRO-005` | An attempt tagged with one section's id does not affect another section's unlock state or star count | FR-PRO-002 |
| `TS-U-PRO-006` | `buildSessionArc` wraps up to 3 unlocked, under-starred (`bestStars < 2` or unattempted) quest sections with a free-play step at each end | TA-APP-005, FR-EXP-008 |
| `TS-U-PRO-007` | `buildSessionArc` is deterministic — same progress and injected random source, same arc, every run | TA-APP-005, ADR-005 |

---

## 7. Renderer geometry — `TS-U-REN-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-REN-001` | White keys tile uniformly across the range | TA-REN-002 |
| `TS-U-REN-002` | Black keys are inset and overlap their neighbours | TA-REN-002 |
| `TS-U-REN-003` | The 2–3 black-key grouping repeats correctly every octave | TA-REN-002 |
| `TS-U-REN-004` | Pitch 21 maps to x = 0 and pitch 108 to the right edge for an 88-key range | TA-REN-002, ADR-009 |
| `TS-U-REN-005` | A 61-key range renders 61 keys, not a scaled 88 | TA-REN-002 |
| `TS-U-REN-006` | Note y-position derives from clock time, not a frame counter | TA-REN-001 |
| `TS-U-REN-007` | A song's chord symbols overlay the falling-notes view at their tick position, not a fixed offset | TA-REN-001, FR-STU-013 |
| `TS-U-REN-008` | `arrangementToMusicXml` places notes into successive measures once cumulative ticks cross a measure boundary, for both 4/4 and 3/4 | TA-REN-003 |
| `TS-U-REN-009` | `arrangementToMusicXml` maps `durationTicks` to the correct MusicXML note type and spells a sharp pitch class with `<alter>1</alter>` | TA-REN-003 |
| `TS-U-REN-010` | `arrangementToMusicXml` emits exactly one `<note>` per source note with no synthesized rests, and throws for an unknown track or an unmapped duration | TA-REN-003 |
| `TS-U-REN-011` | `fitKeyboardRange` pads the notes' span, keeps at least 24 semitones, aligns to white keys and clamps to the profile range | TA-REN-001, FR-STU-015 |
| `TS-U-REN-012` | `noteName` gives middle C as C4, spells black keys with a sharp and can drop the octave | TA-REN-001, FR-STU-015 |
| `TS-U-REN-013` | Each black key's centre is within 0.15 of the boundary between its two white neighbours, as on a real keybed | TA-REN-002, FR-EXP-005 |

`TS-U-REN-007` is delivered (`FallingNotesCanvas.tsx`, `US-3.14`) —
`chordMarkers[].atTick` converts through `clock.ticksToAudio` the same way a
note's `startTick` does, so a marker's on-screen position is tick-derived,
not a fixed pixel offset — but it has **no automated test**, unlike
`TS-U-REN-001`–`006`. Those scenarios test the pure `pitchToX` function
(`pitchToX.test.ts`); this one lives inside the canvas render loop itself,
which nothing in this codebase currently extracts into a testable pure
function (`TS-U-REN-001`–`006`'s own precedent). Verified this session by
browser inspection of `/studio/songs/[id]` only — a real automated test
needs that extraction, not yet done.

---

## 8. Data and sync — `TS-I-*`

### Profile (unit) — `TS-U-DAT-*`

| ID | Scenario | Verifies |
|---|---|---|
| `TS-U-DAT-001` | `createProfile` defaults the explorer role to `toleranceScale` 1.6 | TA-DAT-004, TA-MAT-006 |
| `TS-U-DAT-002` | `createProfile` defaults the student role to `toleranceScale` 1.0 | TA-DAT-004, TA-MAT-006 |
| `TS-U-DAT-003` | Adding a piece to the library twice is idempotent — one entry, keyed `profileId+arrangementId` | TA-DAT-007 |

### Persistence

| ID | Scenario | Verifies |
|---|---|---|
| `TS-I-DAT-001` | An attempt written to IndexedDB survives a page reload | TA-DAT-003, FR-PRO-003 |
| `TS-I-DAT-002` | Attempts are flushed per section, so a crash mid-piece loses at most one section | NFR-007 |
| `TS-I-DAT-003` | Querying by `profileId+startedAt` returns attempts in order | TA-DAT-003 |
| `TS-I-DAT-004` | Progression state recomputes identically from an attempt history | FR-PRO-002, TA-SYN-003 |
| `TS-I-DAT-005` | Schema migration from v1 to v2 preserves all attempts | TA-DAT-003 |
| `TS-I-DAT-006` | Two profiles' data never cross-read | FR-PRO-001 |
| `TS-I-DAT-007` | A library status change overwrites the same row (not append); delete removes it; a `profileId` query never leaks another profile's entries | TA-DAT-007, FR-PRO-006 |
| `TS-I-DAT-008` | A user progression saved to the profile's settings record survives a reload, removal deletes it, and saving keeps the record's other settings fields intact | TA-DAT-003, FR-STU-015 |
| `TS-I-DAT-009` | Songs added to "my songs" are saved once each on the profile's settings record beside its other fields, survive a reload, and removal deletes them; a malformed record yields no ids | TA-DAT-003, FR-STU-016 |
| `TS-I-DAT-010` | A pasted chart is saved on the settings record without disturbing its other fields and plays back; songs survive a reload, stay per profile and can be removed; a chordless chart and a non-MIDI file are refused with nothing saved; a MIDI file round-trips through base64; a one-bar MusicXML piece plays | TA-DAT-003, TA-CNT-007, FR-STU-017 |
| `TS-I-DAT-011` | A Learn tick is saved beside the record's other fields, survives a reload and can be undone; a malformed record yields no ticks | TA-DAT-003, FR-STU-019 |

### Sync

Status: `TS-I-SYN-001`–`003`, `005`–`008`, `010`, `011` have automated tests against fakes (`outboxStorage.test.ts`, `syncEngine.test.ts`, `mapping.test.ts`). `TS-I-SYN-004` runs at the database level via `supabase/tests/rls.sql` and passes. `TS-I-SYN-009` is automated in `syncEngine.test.ts` (a hung backend does not delay a session's writes, and `sync()` never rejects). Tombstone, flashcard and permanent-rejection behaviour is covered in `supabaseBackend.test.ts` and `syncEngine.test.ts`; `rls.sql` also covers `flashcards` and tombstones and passed against the live project after the part-2 migration was applied.

| ID | Scenario | Verifies |
|---|---|---|
| `TS-I-SYN-001` | A local write appends an outbox op | TA-SYN-004 |
| `TS-I-SYN-002` | Outbox flushes when the network returns and empties | TA-SYN-004, FR-SYN-002 |
| `TS-I-SYN-003` | A failed push is retried and does not lose the op | TA-SYN-004 |
| `TS-I-SYN-004` | **RLS** — a second authenticated user cannot read the first user's rows | TA-SYN-005, FR-SYS-008 |
| `TS-I-SYN-005` | Pull on a fresh device restores all profiles and attempts | FR-SYN-003 |
| `TS-I-SYN-006` | The same attempt pushed twice does not duplicate (idempotent on client uuid) | TA-SYN-003 |
| `TS-I-SYN-007` | Settings conflict resolves last-write-wins on `updatedAt` | TA-SYN-003 |
| `TS-I-SYN-008` | Two devices appending different attempts both survive — no conflict | TA-SYN-003 |
| `TS-I-SYN-009` | **Sync never blocks practice** — with the network hung, a full session completes at normal speed | FR-SYN-002, ADR-003 |
| `TS-I-SYN-010` | A paused Supabase project degrades to "sync behind", not an app outage | TA-SYN-006 |
| `TS-I-SYN-011` | Library conflict resolves last-write-wins on `updatedAtMs`, same policy class as settings/profiles | TA-SYN-003, TA-DAT-007 |

### MIDI adapter

| ID | Scenario | Verifies |
|---|---|---|
| `TS-I-MID-001` | `WebMidiBackend` enumerates inputs and opens the selected one | FR-SYS-001 |
| `TS-I-MID-002` | Chosen input is remembered and reopened on next launch | FR-SYS-001 |
| `TS-I-MID-003` | Mid-session disconnect pauses and preserves the in-progress attempt | FR-SYS-004, TA-MID-005 |
| `TS-I-MID-004` | Reconnect resumes without losing state | FR-SYS-004 |
| `TS-I-MID-005` | Absent `requestMIDIAccess` shows the unsupported-browser explanation | FR-SYS-005 |

*Status:* `TS-I-MID-002` is half automated (`src/runtime/stores/midiMemory.test.ts`): the chosen input is written to the profile and listed first after a reload. Reopening it with no tap is not built yet.

---

## 9. Golden fixtures — `TS-G-*`

Recorded real performances replayed end-to-end through decode → pedal → matcher →
grade, asserting the **exact** resulting `Grade`. These are the regression net that
makes tolerance tuning safe.

| ID | Fixture | Asserts |
|---|---|---|
| `TS-G-001` | Adult, clean run of an 8-bar tune at 100% tempo | 3 stars, accuracy 1.0, \|rushDrag\| < 20 ms |
| `TS-G-002` | Adult, same tune consistently rushing | 3 stars, `rushDragMs` negative and > 25 ms in magnitude |
| `TS-G-003` | Child, wait mode, long pauses between notes | Completion 1.0, ≥ 1 star, no timeout artefacts |
| `TS-G-004` | Child, several wrong notes then corrections | Extras recorded, stream still completes |
| `TS-G-005` | Heavy sustain pedal use throughout | Note durations graded on key-up, not on sound-stop |
| `TS-G-006` | Rolled chords played over ~200 ms | Each chord scores as one group, not three errors |
| `TS-G-007` | Hanon exercise, deliberately uneven | `evennessCv` > 0.20 |
| `TS-G-008` | Hanon exercise, even | `evennessCv` < 0.08 |
| `TS-G-009` | Attempt abandoned halfway | Completion ≈ 0.5, stars per threshold, no crash |
| `TS-G-010` | Duet fixture, two players, overlapping timing | Two independent grades, neither affected by the other |

**Rule:** any change to `TA-MAT-006` tolerance constants must be accompanied by
reviewed, intentional updates to these fixtures' expected values. A silent fixture
update in a diff is a review blocker.

---

## 10. End-to-end — `TS-E-*`

Playwright, with a mock MIDI backend injected at the composition root.

| ID | Scenario | Verifies |
|---|---|---|
| `TS-E-001` | First run: connect → create profile → calibrate → play, in under 3 minutes | FR-SYS-003 |
| `TS-E-002` | Cold start to playable under 3 s | NFR-004 |
| `TS-E-003` | Child completes a section and sees a star land on the map | FR-EXP-001, FR-EXP-004 |
| `TS-E-004` | Completing a section unlocks the next node | FR-PRO-002 |
| `TS-E-005` | Profile switch in one tap with no password | FR-PRO-001 |
| `TS-E-006` | Note Ninja: correct answer under 2 s continues a streak | FR-EXP-005 |
| `TS-E-007` | Note Ninja: no answer for 6 s reveals a hint and does not fail | FR-EXP-005 |
| `TS-E-008` | Full session runs with the network disabled and shows no error state | FR-SYN-005, NFR-005 |
| `TS-E-009` | Sign in, practise, sign in on a second browser profile, history is present | FR-SYN-003 |
| `TS-E-010` | Studio A/B loop repeats the selected measures | FR-STU-003 |
| `TS-E-011` | Auto-ramp raises tempo after a clean pass | FR-STU-004 |
| `TS-E-012` | Explorer route bundle contains no OSMD | NFR-006 |
| `TS-E-013` | `prefers-reduced-motion` suppresses particle effects but keeps falling notes | NFR-011 |
| `TS-E-014` | All interactive targets are ≥ 44 px | NFR-009 |
| `TS-E-015` | Duet: split point and transposition give each side its own middle C | FR-DUO-001 |
| `TS-E-016` | Boundary lint fails on a deliberate `react` import in `core/` | TA-PORT-005 |

---

## 11. Manual and hardware — `TS-M-*`

These cannot be automated. Run at each sprint exit.

| ID | Scenario | Sprint | Verifies |
|---|---|---|---|
| `TS-M-001` | Round-trip latency measured on the real instrument is under 80 ms after calibration | 0 | RISK-001 |
| `TS-M-002` | Key press to rectangle lighting up feels immediate to the eye | 0 | NFR-001 |
| `TS-M-003` | Instrument's real MIDI quirks documented (velocity-0, active sensing rate, CC behaviour) | 0 | TA-MID-002 |
| `TS-M-004` | Falling notes hold 60 fps for a full 5-minute session with no visible stutter | 1 | NFR-002 |
| `TS-M-005` | A child completes 8 bars in wait mode unassisted | 1 | FR-EXP-003 |
| `TS-M-006` | **The child uses the app daily for a week with no developer present** | 2 | RISK-002 |
| `TS-M-007` | At least one designed feature is observed to be unused and is removed | 2 | RISK-002 |
| `TS-M-008` | Sync round-trips between two physical machines | 2 | FR-SYN-003 |
| `TS-M-009` | The adult prefers this to their existing practice method for a full week | 3 | RISK-005 |
| `TS-M-010` | Notation cursor tracking feels correct while playing, not just in fixtures | 3 | FR-STU-001 |
| `TS-M-011` | Parent and child play four hands and both results feel fair | 4 | FR-DUO-002 |
| `TS-M-012` | Duet transposition feels right to the child — their part sounds where they expect | 4 | FR-DUO-001 |
| `TS-M-013` | Cable disconnected mid-piece: recovery is calm and nothing is lost | 4 | FR-SYS-004 |
| `TS-M-014` | Same golden fixtures produce identical grades on iPad and laptop | 5 | US-5.04 |
| `TS-M-015` | A library song (one two-hand piece, one single line) is played at the real piano in wait mode: each hand lands on the right keys and a chord waits for all its notes | 3 | FR-STU-016 |
| `TS-M-016` | **Manual, not yet run.** On the chord screen with the piano connected: pressing a chord or a progression's Play shows its keys on the keybed pinned at the top without scrolling; Next chord steps through the progression; the three tabs each show only their own content | 3 | FR-STU-015 |
| `TS-M-018` | **Manual, not yet run.** On the chord screen with the piano connected: falling notes stop on the line until the chord is played; played notes turn green and stay at the line until the next chord lands, with upcoming chords pale and dashed, the keybed keeping the played keys green, and the Key picker moving the progression to another key; the Speed slider slows them; the bars fill the width; Music score shows the chords and moves left to right only when the right keys are played | 3 | FR-STU-015 |
| `TS-M-017` | **Manual, not yet run.** On a second device signed in to the same account: profiles appear after sync; a pasted chart and an imported MIDI file are added to "my songs", play at the piano in wait mode, and are still there after a reload; "Play something for me" opens a progression with its rhythm chosen | 3 | FR-STU-017, FR-STU-018 |

---

## 12. Coverage matrix

Every `M`-priority requirement has at least one automated scenario, and every
critical-path behaviour has a manual confirmation.

| Requirement | Automated | Manual |
|---|---|---|
| FR-EXP-002 | TS-U-REN-001…006, TS-E-003 | TS-M-004 |
| FR-EXP-003 | TS-U-MAT-001…008 | TS-M-005 |
| FR-EXP-004 | TS-U-CNT-007, TS-U-CNT-016, 017, TS-E-003 | TS-M-006 |
| FR-EXP-005 | TS-U-GRD-013, 014, 016, 017, TS-E-006, TS-E-007 | TS-M-006 |
| FR-EXP-006 | — | TS-M-006 |
| FR-EXP-007 | TS-U-GRD-001…005, 015, TS-U-MAT-010…018 | TS-M-006 |
| FR-EXP-008 | TS-U-PRO-006, 007 | TS-E-013 |
| FR-STU-001 | TS-E-010 | TS-M-010 |
| FR-STU-003 | TS-U-CLK-011…014, TS-E-010 | TS-M-009 |
| FR-STU-004 | TS-U-CLK-003, TS-E-011 | TS-M-009 |
| FR-STU-007 | TS-U-GRD-008, 009, TS-U-CNT-020, TS-G-007, 008 | TS-M-009 |
| FR-STU-008 | TS-U-GRD-006, 007, 018, 019 | — |
| FR-STU-010 | TS-U-CNT-021 | — |
| FR-STU-012 | TS-U-MAT-023…025, TS-U-CNT-019 | — |
| FR-STU-013 | TS-U-REN-007 | — |
| FR-STU-015 | TS-U-CNT-022…027, 042…045, TS-U-CLK-015, TS-U-REN-011, 012, TS-U-MAT-026, TS-I-DAT-008 | TS-M-016, TS-M-018 |
| FR-STU-016 | TS-U-CNT-028, 029, 051, 052, TS-I-DAT-009 | TS-M-015 |
| FR-STU-017 | TS-U-CNT-030…035, 047…050, TS-I-DAT-010 | TS-M-017 |
| FR-STU-018 | TS-U-CNT-036…041, 045 | TS-M-017 |
| FR-STU-019 | TS-I-DAT-011 | — |
| FR-DUO-001 | TS-E-015 | TS-M-012 |
| FR-DUO-002 | TS-U-MAT-021, TS-G-010 | TS-M-011 |
| FR-PRO-001 | TS-U-DAT-001, 002, TS-U-PRO-010, TS-I-DAT-006, TS-E-005 | — |
| FR-PRO-002 | TS-U-PRO-001…005, TS-I-DAT-004, TS-E-004 | — |
| FR-PRO-003 | TS-I-DAT-001, 002 | — |
| FR-PRO-006 | TS-U-DAT-003, TS-I-DAT-007, TS-I-SYN-011 | — |
| FR-CON-001 | TS-U-CNT-001…004, 018 | — |
| FR-CON-003 | TS-U-CNT-007, 008 | — |
| FR-CON-004 | TS-U-CNT-009, 010 | — |
| FR-SYN-001 | TS-I-SYN-004 | — |
| FR-SYN-002 | TS-I-SYN-001…003, 009 | TS-M-008 |
| FR-SYN-003 | TS-I-SYN-005, TS-E-009 | TS-M-008 |
| FR-SYN-005 | TS-E-008, TS-I-SYN-010 | — |
| FR-SYS-001 | TS-I-MID-001, 002 | TS-M-003 |
| FR-SYS-002 | TS-U-CLK-007, 008 | TS-M-001 |
| FR-SYS-003 | TS-E-001 | — |
| FR-SYS-004 | TS-I-MID-003, 004 | TS-M-013 |
| FR-SYS-005 | TS-I-MID-005 | — |
| FR-SYS-007 | TS-E-013, TS-E-014 | — |
| FR-SYS-008 | TS-I-SYN-004 | — |
