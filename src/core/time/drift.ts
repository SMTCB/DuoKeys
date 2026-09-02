// TA-CLK-003 — EMA drift correction between the wall clock and the audio clock.
//
// offset = audioNow - (wallNow / 1000), smoothed with alpha = 0.05.
// wallToAudio applies the smoothed offset only, never a raw sample.

import type { Millis, Seconds } from './types';
import { asSeconds } from './types';

const ALPHA = 0.05;

export class DriftTracker {
  private smoothedOffsetSeconds: Seconds | undefined;

  /** Feed one (wallNow, audioNow) sample taken at the same instant. */
  sample(wallNow: Millis, audioNow: Seconds): void {
    const rawOffset = asSeconds(audioNow - wallNow / 1000);
    this.smoothedOffsetSeconds =
      this.smoothedOffsetSeconds === undefined
        ? rawOffset
        : asSeconds(
            ALPHA * rawOffset + (1 - ALPHA) * this.smoothedOffsetSeconds,
          );
  }

  /** Convert a wall-clock timestamp to the audio clock using the smoothed offset. */
  wallToAudio(t: Millis): Seconds {
    const offset = this.smoothedOffsetSeconds ?? asSeconds(0);
    return asSeconds(t / 1000 + offset);
  }

  offsetSeconds(): Seconds | undefined {
    return this.smoothedOffsetSeconds;
  }
}
