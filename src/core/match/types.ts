// TA-MAT-001 — the matcher interface, shared by WaitMatcher and TimedMatcher.

import type { MidiPitch } from '../midi/decode';
import type { Ticks } from '../time/types';

export interface ExpectedNote {
  id: string;
  pitch: MidiPitch;
  atTick: Ticks;
  groupId: string; // TA-MAT-004 — notes within 30 ticks share a groupId
}

export interface PerformanceEvent {
  pitch: MidiPitch;
  velocity: number;
  timeStamp: number; // Millis, kept as a bare number here to match TA-MAT-001 verbatim
}

export interface Matcher {
  expect(events: ExpectedNote[]): void;
  consume(e: PerformanceEvent): MatchResult;
  state(): MatcherState;
  reset(): void;
}

export type MatchResult =
  | { kind: 'correct'; expectedId: string; deltaMs: number }
  | { kind: 'extra'; pitch: MidiPitch } // note not expected here
  | { kind: 'wrong'; expectedId: string; pitch: MidiPitch; error: PitchErrorKind }
  | { kind: 'ignored' }; // e.g. below velocity floor

export type PitchErrorKind = 'neighbour' | 'octave' | 'other';

export interface MatcherState {
  groupIndex: number;
  totalGroups: number;
  pending: readonly MidiPitch[];
  complete: boolean;
}

/** TA-MAT-005 — notes below this velocity are ignored, not wrong. */
export const VELOCITY_FLOOR = 12;

export function classifyPitchError(playedPitch: MidiPitch, expectedPitch: MidiPitch): PitchErrorKind {
  const delta = Math.abs((playedPitch as number) - (expectedPitch as number));
  if (delta === 0) return 'other';
  if (delta % 12 === 0) return 'octave';
  if (delta <= 2) return 'neighbour';
  return 'other';
}

/**
 * TA-MAT-004 / TA-CNT-001 step 4 — notes within `thresholdTicks` of each other
 * are one musical decision. Content authoring runs this at build time; Sprint 1's
 * single hand-authored tune (US-1.13) runs it directly since there is no content
 * pipeline yet.
 */
export function groupNotesByTicks<T extends { atTick: Ticks }>(
  notes: readonly T[],
  thresholdTicks = 30,
): (T & { groupId: string })[] {
  const sorted = [...notes].sort((a, b) => (a.atTick as number) - (b.atTick as number));
  const result: (T & { groupId: string })[] = [];
  let groupIndex = -1;
  let groupAnchorTick: number | undefined;

  for (const note of sorted) {
    const tick = note.atTick as number;
    if (groupAnchorTick === undefined || tick - groupAnchorTick > thresholdTicks) {
      groupIndex++;
      groupAnchorTick = tick;
    }
    result.push({ ...note, groupId: `g${groupIndex}` });
  }
  return result;
}
