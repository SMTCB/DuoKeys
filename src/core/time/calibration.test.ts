import { describe, expect, it } from 'vitest';
import { TapCalibrator, medianTapOffset } from './calibration';
import { asMillis } from './types';

describe('calibration', () => {
  // TS-U-CLK-007
  it('uses median so a single outlier tap has no effect', () => {
    const taps = Array.from({ length: 15 }, () => asMillis(45)).concat(asMillis(400));
    expect(medianTapOffset(taps)).toBe(45);
  });

  // TS-U-CLK-008
  it('reports failure rather than a bad number with fewer than 8 usable taps', () => {
    const calibrator = new TapCalibrator();
    for (let i = 0; i < 7; i++) calibrator.recordTap(asMillis(40 + i));
    const result = calibrator.compute();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('too-few-samples');
      expect(result.tapsRecorded).toBe(7);
    }
  });

  it('computes a result once the minimum usable taps are reached', () => {
    const calibrator = new TapCalibrator();
    for (let i = 0; i < 8; i++) calibrator.recordTap(asMillis(45));
    const result = calibrator.compute();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.latencyOffsetMs).toBe(45);
      expect(result.tapsUsed).toBe(8);
    }
  });

  it('isComplete is true once the target tap count is reached', () => {
    const calibrator = new TapCalibrator();
    expect(calibrator.isComplete()).toBe(false);
    for (let i = 0; i < 16; i++) calibrator.recordTap(asMillis(45));
    expect(calibrator.isComplete()).toBe(true);
  });
});
