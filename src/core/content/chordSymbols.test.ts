import { describe, expect, it } from 'vitest';
import { asPitchClass } from './chordTypes';
import { chordEntryFromId, chordSymbolOfId, idOfChord, parseChordToken, parseProgressionText } from './chordSymbols';

const C = asPitchClass(0);
const ids = (text: string, key = C, mode: 'major' | 'minor' = 'major') =>
  parseProgressionText(text, key, mode).chords.map(idOfChord);

describe('chord symbols', () => {
  it('reads plain symbols', () => {
    expect(ids('C G Am F')).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
  });

  it('reads extensions, flats, sharps and slash chords', () => {
    expect(ids('Dm7 G7 Cmaj7')).toEqual(['D-min7', 'G-dom7', 'C-maj7']);
    expect(ids('Bb Eb/G F#dim C9 Cm7b5')).toEqual(['A#-maj', 'D#-maj', 'F#-dim', 'C-dom9', 'C-min7b5']);
  });

  it('accepts bars, commas, arrows and dashes as separators', () => {
    expect(ids('C | G | Am | F')).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
    expect(ids('C, G → Am - F')).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
    expect(ids('C-G-Am-F')).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
  });

  it('reads Roman numerals in the chosen key', () => {
    expect(ids('I V vi IV', asPitchClass(7))).toEqual(['G-maj', 'D-maj', 'E-min', 'C-maj']);
    expect(ids('I-V-vi-IV')).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
    expect(ids('ii7 V7 Imaj7')).toEqual(['D-min7', 'G-dom7', 'C-maj7']);
    // In a minor key the numerals follow the natural minor scale (as the catalogue's do): VII is G in A minor.
    expect(ids('i VII VI', asPitchClass(9), 'minor')).toEqual(['A-min', 'G-maj', 'F-maj']);
    expect(ids('I bVII IV')).toEqual(['C-maj', 'A#-maj', 'F-maj']);
  });

  it('reports every token it cannot read', () => {
    const result = parseProgressionText('C Xyz G Hm', C, 'major');
    expect(result.chords).toHaveLength(2);
    expect(result.errors).toHaveLength(2);
    expect(parseChordToken('Cfoo', C, 'major')).toMatchObject({ ok: false });
  });

  it('round-trips ids to voicings and chart symbols', () => {
    expect(chordEntryFromId('A-min7')?.midiNotes).toEqual([69, 72, 76, 79]);
    expect(chordEntryFromId('Q-maj')).toBeUndefined();
    expect(chordSymbolOfId('C#-min7')).toBe('C#m7');
    expect(chordSymbolOfId('G-maj')).toBe('G');
  });
});
