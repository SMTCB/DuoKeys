// TA-GRD-005 — Note Ninja response-time bands (US-2.13, FR-EXP-005). Pure
// classification only: no losing, no timer, no deduction — the hint band
// still counts as a correct answer.

export type ResponseBand = 'fast' | 'correct' | 'hinted';

export const FAST_THRESHOLD_SECONDS = 2;
export const HINT_THRESHOLD_SECONDS = 6;

export function classifyResponse(elapsedSeconds: number): ResponseBand {
  if (elapsedSeconds < FAST_THRESHOLD_SECONDS) return 'fast';
  if (elapsedSeconds <= HINT_THRESHOLD_SECONDS) return 'correct';
  return 'hinted';
}
