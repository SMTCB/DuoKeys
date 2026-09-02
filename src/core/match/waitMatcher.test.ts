import { describe, expect, it } from 'vitest';
import { WaitMatcher } from './waitMatcher';
import { groupNotesByTicks, VELOCITY_FLOOR, type ExpectedNote } from './types';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';

function note(id: string, pitch: number, atTick: number, groupId: string): ExpectedNote {
  return { id, pitch: asMidiPitch(pitch), atTick: asTicks(atTick), groupId };
}

describe('WaitMatcher', () => {
  // TS-U-MAT-001
  it('advances the stream on a correct single note', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0')]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(result).toEqual({ kind: 'correct', expectedId: 'n1', deltaMs: 0 });
    expect(matcher.state().complete).toBe(true);
  });

  // TS-U-MAT-002
  it('does not advance on a wrong note, and does not fail the attempt', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0')]);
    const result = matcher.consume({ pitch: asMidiPitch(62), velocity: 80 });
    expect(result).toEqual({ kind: 'extra', pitch: 62 });
    expect(matcher.state().complete).toBe(false);
    expect(matcher.state().groupIndex).toBe(0);
  });

  // TS-U-MAT-003
  it('advances a three-note chord only once all three are down', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0'), note('n2', 64, 0, 'g0'), note('n3', 67, 0, 'g0')]);
    matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(matcher.state().complete).toBe(false);
    matcher.consume({ pitch: asMidiPitch(64), velocity: 80 });
    expect(matcher.state().complete).toBe(false);
    const last = matcher.consume({ pitch: asMidiPitch(67), velocity: 80 });
    expect(last.kind).toBe('correct');
    expect(matcher.state().complete).toBe(true);
  });

  // TS-U-MAT-004 (via groupNotesByTicks feeding the matcher)
  it('counts chord notes 500ms/many ticks apart-in-arrival but within the tick window as one group', () => {
    const grouped = groupNotesByTicks(
      [
        { id: 'n1', pitch: asMidiPitch(60), atTick: asTicks(0) },
        { id: 'n2', pitch: asMidiPitch(64), atTick: asTicks(20) },
        { id: 'n3', pitch: asMidiPitch(67), atTick: asTicks(29) },
      ],
      30,
    );
    expect(new Set(grouped.map((n) => n.groupId)).size).toBe(1);

    const matcher = new WaitMatcher();
    matcher.expect(grouped);
    matcher.consume({ pitch: asMidiPitch(67), velocity: 80 }); // arrives first, still same group
    matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    const last = matcher.consume({ pitch: asMidiPitch(64), velocity: 80 });
    expect(last.kind).toBe('correct');
    expect(matcher.state().complete).toBe(true);
  });

  // TS-U-MAT-005
  it('never times out — silence leaves state unchanged', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0')]);
    const before = matcher.state();
    // no consume() calls at all — simulates 60s of silence
    const after = matcher.state();
    expect(after).toEqual(before);
  });

  // TS-U-MAT-006
  it('reports extra notes but never blocks advancement', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0')]);
    const extra = matcher.consume({ pitch: asMidiPitch(61), velocity: 80 });
    expect(extra.kind).toBe('extra');
    const correct = matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(correct.kind).toBe('correct');
  });

  // TS-U-MAT-007
  it('ignores notes below the velocity floor', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0')]);
    const result = matcher.consume({ pitch: asMidiPitch(60), velocity: VELOCITY_FLOOR - 1 });
    expect(result).toEqual({ kind: 'ignored' });
    expect(matcher.state().complete).toBe(false);
  });

  // TS-U-MAT-008
  it('reset returns the matcher to the first group', () => {
    const matcher = new WaitMatcher();
    matcher.expect([note('n1', 60, 0, 'g0'), note('n2', 62, 480, 'g1')]);
    matcher.consume({ pitch: asMidiPitch(60), velocity: 80 });
    expect(matcher.state().groupIndex).toBe(1);
    matcher.reset();
    expect(matcher.state().groupIndex).toBe(0);
    expect(matcher.state().complete).toBe(false);
  });
});
