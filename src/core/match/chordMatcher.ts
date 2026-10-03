// TA-MAT-007 — ChordMatcher: pitch-class-set (mod 12) matching for the
// chord explorer (US-3.13, FR-STU-012). New, sibling to Matcher
// (waitMatcher.ts / types.ts), not a variant of it: a suggested chord has
// no stream position to match against, only an unordered target set, and
// the free-play philosophy (FR-EXP-006) means there is no `wrong` and no
// timeout — only `complete` and `partial`. Extra non-chord notes never
// block completion.

import { VELOCITY_FLOOR, type PerformanceEvent } from './types';
import { asPitchClass, type PitchClass } from '../content/chordTypes';
import type { MidiPitch } from '../midi/decode';

/**
 * The same "one decision" co-incidence window as TA-MAT-004's chord
 * grouping, expressed in wall time rather than ticks, since chord/
 * progression playback in the explorer has no tempo map driving it. A gap
 * longer than this past the first note of a strike starts a fresh one,
 * discarding whatever was accumulated so far.
 */
const COINCIDENCE_WINDOW_MS = 150;

export type ChordMatchResult =
  | { kind: 'complete' }
  | { kind: 'partial'; missing: readonly PitchClass[] }
  | { kind: 'ignored' }; // TA-MAT-005 — below the velocity floor

export interface ChordMatcherState {
  target: readonly PitchClass[];
  played: readonly PitchClass[];
  complete: boolean;
}

export class ChordMatcher {
  private target: Set<PitchClass> = new Set();
  private played: Set<PitchClass> = new Set();
  private batchStartMs: number | undefined;

  /** Octave-invariant: any octave of a target pitch counts. */
  setTarget(midiNotes: readonly MidiPitch[]): void {
    this.target = new Set(midiNotes.map((p) => asPitchClass(p as number)));
    this.played = new Set();
    this.batchStartMs = undefined;
  }

  consume(e: PerformanceEvent): ChordMatchResult {
    if (e.velocity < VELOCITY_FLOOR) return { kind: 'ignored' };

    if (this.batchStartMs === undefined || e.timeStamp - this.batchStartMs > COINCIDENCE_WINDOW_MS) {
      this.played = new Set();
      this.batchStartMs = e.timeStamp;
    }
    this.played.add(asPitchClass(e.pitch as number));

    return this.result();
  }

  state(): ChordMatcherState {
    const result = this.result();
    return { target: [...this.target], played: [...this.played], complete: result.kind === 'complete' };
  }

  reset(): void {
    this.played = new Set();
    this.batchStartMs = undefined;
  }

  private result(): ChordMatchResult {
    const missing = [...this.target].filter((pc) => !this.played.has(pc));
    return missing.length === 0 ? { kind: 'complete' } : { kind: 'partial', missing };
  }
}
