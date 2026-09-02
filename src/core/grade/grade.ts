// TA-GRD-001 — grade model. Kept verbatim against
// docs/01-TECHNICAL-ARCHITECTURE.md — if you change this shape, change it there too.

import type { MidiPitch } from '../midi/decode';
import { starsFor, type Stars, type StarOptions } from './stars';

export interface NoteResult {
  expectedId?: string;
  pitch: MidiPitch;
  outcome: 'correct' | 'wrong' | 'missed' | 'extra' | 'ignored';
  deltaMs?: number;
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

  return {
    accuracy,
    completion,
    rushDragMs,
    timingRmsMs,
    stars: starsFor(accuracy, completion, starOptions),
    perNote: [...perNote],
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function rms(values: readonly number[], about: number): number {
  return Math.sqrt(values.reduce((sum, v) => sum + (v - about) ** 2, 0) / values.length);
}
