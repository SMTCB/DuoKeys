// TA-PORT-004 — deterministic fake for MasterClock's AudioClock dependency.
// Time only advances when told to, so TS-U-*/TS-I-* fixtures never race real time.

import type { AudioClock } from '../../core/time/masterClock';
import { asSeconds, type Seconds } from '../../core/time/types';

export class FakeClock implements AudioClock {
  private time: Seconds = asSeconds(0);

  now(): Seconds {
    return this.time;
  }

  advance(seconds: number): void {
    this.time = asSeconds((this.time as number) + seconds);
  }

  set(seconds: number): void {
    this.time = asSeconds(seconds);
  }
}
