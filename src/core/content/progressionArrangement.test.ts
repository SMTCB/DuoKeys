import { describe, expect, it } from 'vitest';
import { asPitchClass, type ProgressionEntry } from './chordTypes';
import { chordEntryFromId } from './chordSymbols';
import { progressionToArrangement } from './progressionArrangement';

const progression: ProgressionEntry = {
  id: 'p', name: 'C-G', key: asPitchClass(0), mode: 'major', moods: [], chordIds: ['C-maj', 'G-maj'], suggestedBpm: 90,
};
const chords = ['C-maj', 'G-maj'].map((id) => chordEntryFromId(id)!);

describe('progressionToArrangement', () => {
  const arrangement = progressionToArrangement(progression, chords, 2);
  const track = arrangement.tracks[0]!;

  it('lays one bar per chord, repeated', () => {
    expect(arrangement.id).toBe('chords:p');
    expect(track.notes).toHaveLength(2 * 2 * 3);
    expect(arrangement.chordMarkers?.map((m) => m.symbol)).toEqual(['C', 'G', 'C', 'G']);
    expect(arrangement.sections[0]?.endTick).toBe(4 * 4 * 480);
  });

  it('puts a chord\'s notes in one group at one tick', () => {
    const first = track.notes.filter((n) => n.groupId === 'b0');
    expect(first.map((n) => n.pitch)).toEqual([60, 64, 67]);
    expect(new Set(first.map((n) => n.startTick)).size).toBe(1);
  });

  it('skips a chord it has no entry for rather than failing', () => {
    expect(progressionToArrangement(progression, [chords[0]!], 1).tracks[0]!.notes).toHaveLength(3);
  });
});
