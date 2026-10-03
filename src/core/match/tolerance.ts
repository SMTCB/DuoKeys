// TA-MAT-006 — tempo-relative tolerance windows with an absolute floor
// (ADR-007). Kept verbatim against docs/01-TECHNICAL-ARCHITECTURE.md — if
// you change a constant here, change it there too.

export type Tier = 'perfect' | 'good' | 'loose';

export const TOLERANCE: Readonly<Record<Tier, { floorMs: number; fraction: number }>> = {
  perfect: { floorMs: 45, fraction: 0.08 },
  good: { floorMs: 90, fraction: 0.16 },
  loose: { floorMs: 160, fraction: 0.3 },
};

export const windowFor = (tier: Tier, bpm: number): number =>
  Math.max(TOLERANCE[tier].floorMs, (60_000 / bpm) * TOLERANCE[tier].fraction);
