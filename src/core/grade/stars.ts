// TA-GRD-002 — star thresholds.

export type Stars = 0 | 1 | 2 | 3;

export interface StarOptions {
  /** FR-EXP-007 — Explorer mode floors at 1 star on any completed attempt. */
  explorerFloor?: boolean;
}

export function starsFor(accuracy: number, completion: number, options: StarOptions = {}): Stars {
  const raw: Stars =
    accuracy >= 0.95 && completion === 1 ? 3 : accuracy >= 0.8 && completion === 1 ? 2 : completion >= 0.6 ? 1 : 0;
  return options.explorerFloor ? (Math.max(raw, 1) as Stars) : raw;
}
