// TA-GRD-006 — articulation and duration feedback (FR-STU-006). Classifies a
// held note's actual sounding duration (already resolved by the caller
// through PedalTracker's key-up/stopped-sounding distinction — this function
// only sees the resulting duration) against its written duration.

export type ArticulationOutcome = 'short' | 'even' | 'long';

const SHORT_RATIO = 0.7;
const LONG_RATIO = 1.3;

/**
 * TS-U-GRD-020: actual/target below SHORT_RATIO is 'short', above LONG_RATIO
 * is 'long', otherwise 'even'. A target of zero or less (no written duration
 * to compare against) is unclassifiable.
 */
export function classifyArticulation(actualMs: number, targetMs: number): ArticulationOutcome | undefined {
  if (targetMs <= 0) return undefined;
  const ratio = actualMs / targetMs;
  if (ratio < SHORT_RATIO) return 'short';
  if (ratio > LONG_RATIO) return 'long';
  return 'even';
}
