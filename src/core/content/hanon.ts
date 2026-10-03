// TA-CNT-004 — Hanon exercise generator (FR-STU-007, US-3.09): "each is one
// pattern sequenced up the scale — write the generator". A Hanon exercise is
// a short melodic cell, played once per scale degree as it climbs a major
// scale and comes back down, both hands an octave apart. The generator is
// exercise-agnostic; HANON_PATTERNS supplies the cells. No randomness is
// needed here — the whole point of a drill is that it is exactly the same
// every time — so, unlike sightReading.ts, this stays fully deterministic
// with no injected source (ADR-005 is satisfied trivially).
//
// Reuses buildArrangementFromSource (TA-CNT-001 stages 3-6) so a generated
// Hanon exercise is difficulty-scored, sectioned and grouped exactly like
// hand-authored content — the matcher and notation view need no changes.

import { asMidiPitch } from '../midi/decode';
import { midiPitchToNoteName } from './noteName';
import { buildArrangementFromSource, type SourceInput, type SourceNoteInput } from './buildArrangement';
import type { Arrangement } from './types';

export interface HanonPattern {
  id: string;
  title: string;
  /** Scale-degree offsets (0-based, diatonic) from the cell's own starting degree — one measure of the drill. */
  cellDegrees: readonly number[];
  /** Duration of every note in the cell, in ticks (PPQ 480) — Hanon's cells are a single fixed subdivision. */
  noteDurationTicks: number;
}

// Hanon No. 1 (The Virtuoso Pianist in 60 Exercises, Part 1) — first
// published 1873, Hanon died 1900; public domain. The
// right-hand cell for one measure: C E F G A G F E, i.e. scale degrees
// 0 2 3 4 5 4 3 2 relative to wherever the measure starts (a turn up to the
// 5th and back). The array previously stored here — [0,2,3,4,3,2,4,3],
// decoding to C E F G F E G F — didn't match this comment; corrected.
//
// Patterns 2-5 below are NOT verified transcriptions of Hanon's actual
// score (US-3.09's remaining 15, patterns 6-20, are deliberately deferred
// rather than guessed — see docs/00-INDEX.md Group C). They're original
// turn/scale/skip figures in the same 8-sixteenth-note, one-octave-drill
// style, titled "Hanon-style" rather than "Hanon No. N" so the UI never
// claims an authenticity it can't back. Swap in real transcriptions
// (against IMSLP or a licensed edition) whenever that source exists.
export const HANON_PATTERNS: readonly HanonPattern[] = [
  {
    id: 'hanon-01',
    title: 'Hanon No. 1',
    cellDegrees: [0, 2, 3, 4, 5, 4, 3, 2],
    noteDurationTicks: 120, // sixteenth note at 480 PPQ
  },
  {
    id: 'hanon-02',
    title: 'Hanon-style Exercise 2 (approximate)',
    cellDegrees: [0, 2, 3, 4, 5, 6, 5, 4], // turn extended up to the 7th
    noteDurationTicks: 120,
  },
  {
    id: 'hanon-03',
    title: 'Hanon-style Exercise 3 (approximate)',
    cellDegrees: [0, 2, 1, 3, 2, 4, 3, 5], // broken-third skip figure
    noteDurationTicks: 120,
  },
  {
    id: 'hanon-04',
    title: 'Hanon-style Exercise 4 (approximate)',
    cellDegrees: [0, 1, 2, 3, 4, 3, 2, 1], // straight scalar run up and back
    noteDurationTicks: 120,
  },
  {
    id: 'hanon-05',
    title: 'Hanon-style Exercise 5 (approximate)',
    cellDegrees: [0, 2, 0, 3, 1, 4, 2, 5], // neighbor-tone skip figure
    noteDurationTicks: 120,
  },
];

const MAJOR_SCALE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

function degreeToSemitone(degree: number): number {
  const octave = Math.floor(degree / 7);
  const withinOctave = ((degree % 7) + 7) % 7;
  return octave * 12 + MAJOR_SCALE_SEMITONES[withinOctave]!;
}

export interface HanonOptions {
  /** Scale degree the drill starts on (0 = tonic). Default 0. */
  startDegree?: number;
  /** How many scale degrees the pattern climbs before returning. Default 7 (one octave). */
  ascendDegrees?: number;
  tempoBpm?: number;
  /** Octave number (MIDI convention, C4 = middle C) the right hand starts in. Default 4. */
  rightHandOctave?: number;
  /** How many octaves below the right hand the left hand plays the same shape. Default 1. */
  handSpanOctaves?: number;
}

/**
 * TS-U-CNT (Hanon): sequences `pattern`'s cell up from `startDegree` through
 * `ascendDegrees` scale steps and back down, one measure per step, right
 * hand at `rightHandOctave` and left hand `handSpanOctaves` below it playing
 * the identical shape (Hanon's own parallel-octave convention). Split out
 * from `generateHanonArrangement` so the build-time ingest pipeline can
 * reuse the same `SourceInput` before it's licence-tagged and grouped.
 */
export function buildHanonSourceInput(pattern: HanonPattern, options: HanonOptions = {}): SourceInput {
  const startDegree = options.startDegree ?? 0;
  const ascendDegrees = options.ascendDegrees ?? 7;
  const tempoBpm = options.tempoBpm ?? 90;
  const rightHandOctave = options.rightHandOctave ?? 4;
  const handSpanOctaves = options.handSpanOctaves ?? 1;

  const steps: number[] = [];
  for (let d = startDegree; d <= startDegree + ascendDegrees; d++) steps.push(d);
  for (let d = startDegree + ascendDegrees - 1; d >= startDegree; d--) steps.push(d);

  const rightBase = (rightHandOctave + 1) * 12; // MIDI pitch of the tonic in that octave
  const leftBase = rightBase - handSpanOctaves * 12;

  const rightNotes: SourceNoteInput[] = [];
  const leftNotes: SourceNoteInput[] = [];
  for (const step of steps) {
    for (const cellDegree of pattern.cellDegrees) {
      const semitoneOffset = degreeToSemitone(step + cellDegree);
      rightNotes.push({
        pitch: midiPitchToNoteName(asMidiPitch(rightBase + semitoneOffset)),
        durationTicks: pattern.noteDurationTicks,
      });
      leftNotes.push({
        pitch: midiPitchToNoteName(asMidiPitch(leftBase + semitoneOffset)),
        durationTicks: pattern.noteDurationTicks,
      });
    }
  }

  return {
    id: pattern.id,
    title: pattern.title,
    tempoBpm,
    // Hanon's own notation: each measure is one cell, 2/4 time (matches the
    // 8-sixteenth-note cell exactly — a 4/4 bar would leave a half-empty
    // measure). One quest section per measure, since each scale-degree step
    // is the drill's natural unit, not a pair of them.
    timeSig: [2, 4],
    keySig: 'C',
    barsPerQuest: 1,
    tracks: [
      { id: 'rh', role: 'rh', hand: 'R', notes: rightNotes },
      { id: 'lh', role: 'lh', hand: 'L', notes: leftNotes },
    ],
  };
}

export function generateHanonArrangement(pattern: HanonPattern, options: HanonOptions = {}): Arrangement {
  return buildArrangementFromSource(buildHanonSourceInput(pattern, options));
}
