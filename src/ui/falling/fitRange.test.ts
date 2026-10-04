import { describe, expect, it } from 'vitest';
import { fitKeyboardRange } from './fitRange';
import type { KeyboardRange } from './pitchToX';

const FULL = { low: 21, high: 108 } as unknown as KeyboardRange;

describe('fitKeyboardRange', () => {
  it('hugs a chord progression instead of spanning all 88 keys', () => {
    const r = fitKeyboardRange([60, 64, 67, 62, 65, 69], FULL);
    expect(r.high as number).toBeLessThan(90);
    expect(r.low as number).toBeGreaterThan(40);
    expect((r.high as number) - (r.low as number)).toBeGreaterThanOrEqual(24);
  });

  it('starts and ends on a white key so no lane is cut in half', () => {
    const r = fitKeyboardRange([61, 66], FULL);
    expect([0, 2, 4, 5, 7, 9, 11]).toContain((r.low as number) % 12);
    expect([0, 2, 4, 5, 7, 9, 11]).toContain((r.high as number) % 12);
  });

  it('never goes outside the keyboard it was given', () => {
    const small = { low: 48, high: 72 } as unknown as KeyboardRange;
    const r = fitKeyboardRange([49, 71], small);
    expect(r.low as number).toBeGreaterThanOrEqual(48);
    expect(r.high as number).toBeLessThanOrEqual(72);
  });

  it('falls back to the whole keyboard when there are no notes', () => {
    expect(fitKeyboardRange([], FULL)).toBe(FULL);
  });
});
