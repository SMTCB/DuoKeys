// TA-GRD-001 — grade model. Kept verbatim against
// docs/01-TECHNICAL-ARCHITECTURE.md — if you change this shape, change it there too.

import type { MidiPitch } from '../midi/decode';
import { starsFor, type Stars, type StarOptions } from './stars';
import type { ArticulationOutcome } from './articulation';

export interface NoteResult {
  expectedId?: string;
  pitch: MidiPitch;
  outcome: 'correct' | 'wrong' | 'missed' | 'extra' | 'ignored';
  deltaMs?: number;
  /**
   * TA-GRD-003 — actual onset time (Millis, kept as a bare number to match
   * this file's other post-decode ms fields, same reasoning as
   * `match/types.ts`'s `PerformanceEvent.timeStamp`). Set only for correct
   * notes, in performed order, so `computeGrade` can derive inter-onset
   * intervals without a second pass over the raw MIDI stream.
   */
  onsetMs?: number;
  /** TA-GRD-006 — set once the held note's release is known; absent until then. */
  articulation?: ArticulationOutcome;
}

export interface Grade {
  accuracy: number; // 0–1, correct notes / expected notes
  completion: number; // 0–1, how far through the section
  rushDragMs: number; // SIGNED mean offset — the actionable number
  timingRmsMs: number; // unsigned spread — consistency
  evennessCv?: number; // coefficient of variation of inter-onset intervals
  stars: Stars;
  perNote: NoteResult[];
}

export function computeGrade(
  perNote: readonly NoteResult[],
  expectedCount: number,
  starOptions: StarOptions = {},
): Grade {
  const correct = perNote.filter((n) => n.outcome === 'correct');
  const resolved = perNote.filter(
    (n) => n.outcome === 'correct' || n.outcome === 'wrong' || n.outcome === 'missed',
  );

  // TS-U-GRD-011: an empty attempt grades 0 without dividing by zero.
  const accuracy = expectedCount === 0 ? 0 : correct.length / expectedCount;
  const completion = expectedCount === 0 ? 0 : resolved.length / expectedCount;

  const deltas = correct.map((n) => n.deltaMs ?? 0);
  const rushDragMs = deltas.length === 0 ? 0 : mean(deltas);
  const timingRmsMs = deltas.length === 0 ? 0 : rms(deltas, rushDragMs);

  const onsetsMs = correct.map((n) => n.onsetMs).filter((t): t is number => t !== undefined);
  const evennessCv = computeEvennessCv(onsetsMs);

  return {
    accuracy,
    completion,
    rushDragMs,
    timingRmsMs,
    ...(evennessCv !== undefined ? { evennessCv } : {}),
    stars: starsFor(accuracy, completion, starOptions),
    perNote: [...perNote],
  };
}

/**
 * TA-GRD-003 — coefficient of variation of inter-onset intervals:
 * `stdev(iois) / mean(iois)`. Below 0.08 is even; above 0.20 is visibly
 * lumpy. Undefined with fewer than three onsets (two intervals) — nothing
 * to compare for evenness yet — or a zero-mean interval (simultaneous
 * onsets), which would otherwise divide by zero.
 */
function computeEvennessCv(onsetsMs: readonly number[]): number | undefined {
  if (onsetsMs.length < 3) return undefined;
  const iois = onsetsMs.slice(1).map((t, i) => t - onsetsMs[i]!);
  const meanIoi = mean(iois);
  if (meanIoi === 0) return undefined;
  return rms(iois, meanIoi) / meanIoi;
}

// FR-STU-008 — directional phrasing for the signed rushDragMs, so the adult
// reads "40 ms ahead of the beat" instead of a bare signed number. Negative
// is early/ahead, positive is late/behind (TS-U-GRD-006's sign convention).
export function describeRushDrag(rushDragMs: number): string {
  const rounded = Math.round(Math.abs(rushDragMs));
  if (rounded === 0) return 'right on the beat';
  return rushDragMs < 0 ? `${rounded} ms ahead of the beat` : `${rounded} ms behind the beat`;
}

/** TA-GRD-006 — summarises the classified notes in a Grade; undefined if none were classified. */
export function describeArticulation(grade: Grade): string | undefined {
  const classified = grade.perNote.filter((n) => n.articulation !== undefined);
  if (classified.length === 0) return undefined;
  const shortCount = classified.filter((n) => n.articulation === 'short').length;
  const longCount = classified.filter((n) => n.articulation === 'long').length;
  if (shortCount === 0 && longCount === 0) return 'Your note lengths matched what was written.';
  if (shortCount >= longCount) return `${shortCount} note${shortCount === 1 ? '' : 's'} cut short — try holding a little longer.`;
  return `${longCount} note${longCount === 1 ? '' : 's'} held too long — try releasing a little sooner.`;
}

// TA-GRD-003 — the same <0.08 even / >0.20 lumpy thresholds computeEvennessCv
// documents, phrased for the Studio completion card. Absent grade.evennessCv
// (fewer than three onsets) simply means "nothing to describe" — callers
// check for that themselves, same pattern as describeArticulation.
export function describeEvenness(evennessCv: number): string {
  if (evennessCv < 0.08) return 'Your timing between notes was very even.';
  if (evennessCv > 0.2) return 'Your timing between notes was uneven — try a slower, steadier tempo.';
  return 'Your timing between notes was reasonably even.';
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function rms(values: readonly number[], about: number): number {
  return Math.sqrt(values.reduce((sum, v) => sum + (v - about) ** 2, 0) / values.length);
}
