import { describe, expect, it } from 'vitest';
import { segmentFallback } from './segmentSections';
import { asTicks } from '../time/types';

describe('segmentFallback', () => {
  it('splits an eight-bar 4/4 piece into four two-bar quests plus a reward', () => {
    const totalTicks = asTicks(8 * 4 * 480);
    const sections = segmentFallback(totalTicks, [4, 4], 'Test Piece');

    const quests = sections.filter((s) => s.kind === 'quest');
    expect(quests).toHaveLength(4);
    expect(quests[0]).toMatchObject({ id: 'bars-1-2', startTick: 0, endTick: 3840, barRange: [1, 2] });
    expect(quests[3]).toMatchObject({ id: 'bars-7-8', startTick: 11520, endTick: 15360, barRange: [7, 8] });

    const rewards = sections.filter((s) => s.kind === 'reward');
    expect(rewards).toHaveLength(1);
    expect(rewards[0]).toMatchObject({ id: 'whole-piece', startTick: 0, endTick: 15360, barRange: [1, 8] });
  });

  it('partitions quest sections contiguously with no gaps or overlaps', () => {
    const totalTicks = asTicks(8 * 4 * 480);
    const quests = segmentFallback(totalTicks, [4, 4], 'Test Piece').filter((s) => s.kind === 'quest');
    for (let i = 1; i < quests.length; i++) {
      expect(quests[i]?.startTick).toBe(quests[i - 1]?.endTick);
    }
  });

  it('throws when the total duration is not a whole number of bars', () => {
    expect(() => segmentFallback(asTicks(1000), [4, 4], 'Bad Piece')).toThrow();
  });

  it('throws when the bar count is not a multiple of barsPerQuest', () => {
    const totalTicks = asTicks(3 * 4 * 480); // 3 bars, not a multiple of 2
    expect(() => segmentFallback(totalTicks, [4, 4], 'Odd Piece')).toThrow();
  });

  it('respects a custom barsPerQuest', () => {
    const totalTicks = asTicks(4 * 4 * 480); // 4 bars
    const quests = segmentFallback(totalTicks, [4, 4], 'Test Piece', 1).filter((s) => s.kind === 'quest');
    expect(quests).toHaveLength(4);
  });
});
