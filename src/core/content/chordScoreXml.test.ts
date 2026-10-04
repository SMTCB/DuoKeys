import { describe, expect, it } from 'vitest';
import { chordsToMusicXml, chordGroups } from './chordScoreXml';
import { progressionToArrangement } from './progressionArrangement';
import type { ChordEntry, ProgressionEntry } from './chordTypes';

const chords = [
  { id: 'C-major', midiNotes: [48, 60, 64, 67] },
  { id: 'G-major', midiNotes: [43, 59, 62, 67] },
] as unknown as ChordEntry[];
const progression = { id: 'p', name: 'Test', chordIds: ['C-major', 'G-major'] } as unknown as ProgressionEntry;

describe('chordsToMusicXml', () => {
  const arrangement = progressionToArrangement(progression, chords, 1);
  const xml = chordsToMusicXml(arrangement, 'chords');

  it('makes one measure per chord, so a cursor step is a matcher group', () => {
    expect(chordGroups(arrangement.tracks[0]!.notes)).toHaveLength(2);
    expect(xml.match(/<measure /g)).toHaveLength(2);
  });

  it('writes a grand staff with the chord tones stacked', () => {
    expect(xml).toContain('<staves>2</staves>');
    expect(xml.match(/<chord\/>/g)?.length).toBe(4); // 2 per chord: treble C-E-G, bass C-C … stacked tones
  });

  it('splits at middle C: low notes on the bass staff', () => {
    expect(xml).toContain('<staff>2</staff>');
    expect(xml).toContain('<octave>2</octave>'); // C2 (48)
  });

  it('labels each measure with its chord symbol', () => {
    expect(xml.match(/<words /g)).toHaveLength(2);
  });
});
