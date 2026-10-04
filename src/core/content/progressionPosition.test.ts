import { describe, expect, it } from 'vitest';
import { progressionPosition } from './progressionPosition';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';
import type { ChordMarker, ContentNote } from './types';

const note = (id: string, tick: number, groupId: string): ContentNote => ({
  id,
  pitch: asMidiPitch(60),
  startTick: asTicks(tick),
  durationTicks: asTicks(100),
  groupId,
  trackId: 'chords',
});
const marker = (tick: number, symbol: string): ChordMarker => ({ atTick: asTicks(tick), symbol });

describe('progressionPosition', () => {
  // TS-U-CNT-043
  const markers = [marker(0, 'C'), marker(1000, 'F'), marker(2000, 'C'), marker(3000, 'F')];
  const notes = [note('a', 0, 'g0'), note('b', 500, 'g1'), note('c', 1000, 'g2'), note('d', 2000, 'g3'), note('e', 3000, 'g4')];

  it('reports the chord and round of the group being played', () => {
    expect(progressionPosition(markers, notes, 0, 2)).toEqual({ chordIndex: 0, round: 1, totalRounds: 2 });
    expect(progressionPosition(markers, notes, 1, 2)).toEqual({ chordIndex: 0, round: 1, totalRounds: 2 });
    expect(progressionPosition(markers, notes, 2, 2)).toEqual({ chordIndex: 1, round: 1, totalRounds: 2 });
    expect(progressionPosition(markers, notes, 3, 2)).toEqual({ chordIndex: 0, round: 2, totalRounds: 2 });
  });

  it('stays on the last group once the matcher is past the end, and is undefined with no markers', () => {
    expect(progressionPosition(markers, notes, 9, 2)?.chordIndex).toBe(1);
    expect(progressionPosition([], notes, 0, 2)).toBeUndefined();
  });
});
