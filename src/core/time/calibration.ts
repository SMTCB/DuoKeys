// TA-CLK-004 — tap-along latency calibration.
//
// Median (not mean) of up to 16 taps against a metronome beat. The result is
// stored as Profile.latencyOffsetMs and subtracted from every subsequent MIDI
// event before grading (TA-MID-001's latencyShift stage).

import type { Millis } from './types';
import { asMillis } from './types';

export const CALIBRATION_TARGET_TAPS = 16;
export const CALIBRATION_MIN_USABLE_TAPS = 8;

/** offsetMs: how late (positive) or early (negative) the tap landed vs. the beat. */
export function medianTapOffset(offsetsMs: readonly Millis[]): Millis {
  if (offsetsMs.length === 0) {
    throw new Error('medianTapOffset: at least one sample required');
  }
  const sorted = [...offsetsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;
  return asMillis(median);
}

export type CalibrationResult =
  | { ok: true; latencyOffsetMs: Millis; tapsUsed: number }
  | { ok: false; reason: 'too-few-samples'; tapsRecorded: number };

/** TS-U-CLK-008: fewer than CALIBRATION_MIN_USABLE_TAPS reports failure, not a bad number. */
export class TapCalibrator {
  private readonly offsets: Millis[] = [];

  constructor(private readonly targetTaps: number = CALIBRATION_TARGET_TAPS) {}

  recordTap(offsetMs: Millis): void {
    this.offsets.push(offsetMs);
  }

  tapsRecorded(): number {
    return this.offsets.length;
  }

  isComplete(): boolean {
    return this.offsets.length >= this.targetTaps;
  }

  compute(): CalibrationResult {
    if (this.offsets.length < CALIBRATION_MIN_USABLE_TAPS) {
      return { ok: false, reason: 'too-few-samples', tapsRecorded: this.offsets.length };
    }
    return {
      ok: true,
      latencyOffsetMs: medianTapOffset(this.offsets),
      tapsUsed: this.offsets.length,
    };
  }

  reset(): void {
    this.offsets.length = 0;
  }
}
