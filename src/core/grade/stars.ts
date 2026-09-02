// TA-GRD-002 — star thresholds.

export type Stars = 0 | 1 | 2 | 3;

export interface StarOptions {
  /** FR-EXP-007 — Explorer mode floors at 1 star on any completed attempt. */
  explorerFloor?: boolean;
}

export function starsFor(accuracy: number, completion: number, options: StarOptions = {}): Stars {
  if (accuracy >= 0.95 && completion === 1) return 3;
  if (accuracy >= 0.8 && completion === 1) return 2;
  if (completion >= 0.6) return 1;
  if (options.explorerFloor && completion === 1) return 1;
  return 0;
}
