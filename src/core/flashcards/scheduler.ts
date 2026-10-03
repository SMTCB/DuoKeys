// TA-DAT-006 — Leitner-style box scheduling for Note Ninja's flashcard pool.
// A struggling card resets to box 1 and resurfaces almost immediately; a
// card the child finds easy climbs and comes back less often. Pure — no
// clock reads (ADR-005), `nowMs` is always injected by the caller.

import type { Box, Flashcard } from '../data/flashcard';
import { asMillis, type Millis } from '../time/types';

export type ReviewOutcome = 'fast' | 'correct' | 'hinted' | 'wrong';

export const INTERVAL_BY_BOX: Readonly<Record<Box, Millis>> = {
  1: asMillis(0),
  2: asMillis(60_000), // 1 min — resurfaces later this session
  3: asMillis(600_000), // 10 min
  4: asMillis(86_400_000), // 1 day
  5: asMillis(345_600_000), // 4 days
};

export function reviewCard(card: Flashcard, outcome: ReviewOutcome, nowMs: number): Flashcard {
  const box: Box = outcome === 'wrong' ? 1 : outcome === 'fast' ? (Math.min(card.box + 1, 5) as Box) : card.box;
  return { ...card, box, dueAtMs: asMillis(nowMs + (INTERVAL_BY_BOX[box] as number)) };
}
