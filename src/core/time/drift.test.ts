import { describe, expect, it } from 'vitest';
import { DriftTracker } from './drift';
import { asMillis, asSeconds } from './types';

describe('DriftTracker', () => {
  // TS-U-CLK-004
  it('converges on a constant offset within 0.5ms', () => {
    const tracker = new DriftTracker();
    const offsetSeconds = 0.012; // 12ms
    let wall = 0;
    for (let i = 0; i < 50; i++) {
      wall += 100;
      const audio = wall / 1000 + offsetSeconds;
      tracker.sample(asMillis(wall), asSeconds(audio));
    }
    const converted = tracker.wallToAudio(asMillis(wall));
    const truth = wall / 1000 + offsetSeconds;
    expect(Math.abs((converted as number) - truth)).toBeLessThan(0.0005);
  });

  // TS-U-CLK-005
  it('rejects a single outlier — shifts by less than 10ms', () => {
    const tracker = new DriftTracker();
    const offsetSeconds = 0.012;
    let wall = 0;
    for (let i = 0; i < 50; i++) {
      wall += 100;
      tracker.sample(asMillis(wall), asSeconds(wall / 1000 + offsetSeconds));
    }
    const beforeOutlier = tracker.offsetSeconds()!;
    // one event arrives 200ms out
    wall += 100;
    tracker.sample(asMillis(wall), asSeconds(wall / 1000 + offsetSeconds + 0.2));
    const afterOutlier = tracker.offsetSeconds()!;
    expect(Math.abs((afterOutlier as number) - (beforeOutlier as number))).toBeLessThan(0.01);
  });

  // TS-U-CLK-006
  it('keeps correction error bounded over a long, slowly drifting session', () => {
    const tracker = new DriftTracker();
    const driftPerMinute = 0.001; // 1ms/minute
    let wall = 0;
    let maxError = 0;
    for (let minute = 0; minute < 30; minute++) {
      for (let sampleInMinute = 0; sampleInMinute < 6; sampleInMinute++) {
        wall += 10_000; // every 10s
        const trueOffset = (wall / 60000) * driftPerMinute;
        const audio = wall / 1000 + trueOffset;
        tracker.sample(asMillis(wall), asSeconds(audio));
        const converted = tracker.wallToAudio(asMillis(wall));
        const error = Math.abs((converted as number) - audio);
        maxError = Math.max(maxError, error);
      }
    }
    expect(maxError).toBeLessThan(0.005);
  });
});
