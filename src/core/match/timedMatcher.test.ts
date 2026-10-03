import { describe, expect, it } from 'vitest';
import { TimedMatcher, type TimedMatcherClock } from './timedMatcher';
import { reconcileMissed } from '../grade/reconcileMissed';
import type { ExpectedNote } from './types';
import { asMidiPitch } from '../midi/decode';
import { asSeconds, asTicks } from '../time/types';

const BPM = 120;

function note(id: string, pitch: number, atTick: number, groupId = 'g0'): ExpectedNote {
  return { id, pitch: asMidiPitch(pitch), atTick: asTicks(atTick), groupId };
}

/** Ticks map 1:1 to seconds here — the matcher only ever cares about elapsed time, not PPQ. */
function fakeClock(now: number): TimedMatcherClock {
  return {
    now: () => asSeconds(now),
    ticksToSeconds: (t) => asSeconds(t as number),
  };
}

describe('TimedMatcher', () => {
  // TS-U-MAT-010
  it('scores a note within the perfect window as correct with a small deltaMs', () => {
    const matcher = new TimedMatcher(fakeClock(0.52), BPM, 1); // 20ms late
    matcher.expect([note('n1', 60, 0.5)]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result.kind).toBe('correct');
    if (result.kind === 'correct') {
      expect(result.deltaMs).toBeCloseTo(20);
      expect(Math.abs(result.deltaMs)).toBeLessThanOrEqual(45);
    }
  });

  // TS-U-MAT-011
  it('scores a note within good but outside perfect as correct with a larger deltaMs', () => {
    const matcher = new TimedMatcher(fakeClock(0.57), BPM, 1); // 70ms late
    matcher.expect([note('n1', 60, 0.5)]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result.kind).toBe('correct');
    if (result.kind === 'correct') {
      expect(Math.abs(result.deltaMs)).toBeGreaterThan(45);
      expect(Math.abs(result.deltaMs)).toBeLessThanOrEqual(90);
    }
  });

  // TS-U-MAT-012
  it('a note outside loose counts as extra, and the expected note reconciles as missed', () => {
    const expected = [note('n1', 60, 0.5)];
    const matcher = new TimedMatcher(fakeClock(1.5), BPM, 1); // 1s late — well outside 2x loose
    matcher.expect(expected);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result).toEqual({ kind: 'extra', pitch: 60 });

    const reconciled = reconcileMissed(expected, [{ pitch: asMidiPitch(60), outcome: 'extra' }]);
    expect(reconciled).toContainEqual({ expectedId: 'n1', pitch: asMidiPitch(60), outcome: 'missed' });
  });

  // TS-U-MAT-013
  it('monotonic constraint — a late note cannot match an expected slot earlier than one already matched', () => {
    const matcher = new TimedMatcher(fakeClock(1.0), BPM, 1);
    matcher.expect([note('n1', 60, 0.5), note('n2', 60, 1.0)]);
    const first = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(first).toMatchObject({ kind: 'correct', expectedId: 'n2' });

    const second = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(second.kind).toBe('extra'); // n1 was skipped, and the cursor has already moved past it
  });

  // TS-U-MAT-014
  it('greedy nearest-match picks the closer of two candidate expectations', () => {
    const matcher = new TimedMatcher(fakeClock(0.55), BPM, 1);
    matcher.expect([note('n1', 60, 0.4), note('n2', 60, 0.6)]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result).toMatchObject({ kind: 'correct', expectedId: 'n2' });
  });

  // TS-U-MAT-015
  it('an expected note past its window is reported missed exactly once', () => {
    const expected = [note('n1', 60, 0.5), note('n2', 62, 1.0)];
    const matcher = new TimedMatcher(fakeClock(1.0), BPM, 1);
    matcher.expect(expected);
    const result = matcher.consume({ pitch: asMidiPitch(62), velocity: 80 });
    expect(result).toMatchObject({ kind: 'correct', expectedId: 'n2' });

    const reconciled = reconcileMissed(expected, [{ expectedId: 'n2', pitch: asMidiPitch(62), outcome: 'correct' }]);
    const missedEntries = reconciled.filter((n) => n.outcome === 'missed' && n.expectedId === 'n1');
    expect(missedEntries).toHaveLength(1);
  });

  // TS-U-MAT-022
  it('a nearer wrong-pitch slot never steals the match from a same-pitch slot still in window', () => {
    // n1 (pitch 62) is closer in time to "now" (0.02s) than n2 (pitch 60, 0.05s),
    // but the played note is pitch 60 — it must resolve n2, not fall back to n1.
    const matcher = new TimedMatcher(fakeClock(0.55), BPM, 1);
    matcher.expect([note('n1', 62, 0.53), note('n2', 60, 0.6)]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result).toMatchObject({ kind: 'correct', expectedId: 'n2' });
  });

  // TS-U-MAT-018
  it('toleranceScale 1.6 widens all windows proportionally', () => {
    const expected = [note('n1', 60, 0.5)];
    const late = fakeClock(0.85); // 350ms late

    const narrow = new TimedMatcher(late, BPM, 1);
    narrow.expect(expected);
    expect(narrow.consume({ pitch: asMidiPitch(60), velocity: 80 }).kind).toBe('extra');

    const scaled = new TimedMatcher(late, BPM, 1.6);
    scaled.expect(expected);
    expect(scaled.consume({ pitch: asMidiPitch(60), velocity: 80 }).kind).toBe('correct');
  });
});
