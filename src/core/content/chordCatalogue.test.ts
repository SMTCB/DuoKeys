import { describe, expect, it } from 'vitest';
import { generateChordCatalogue, parseDegreeToken } from './chordCatalogue';
import { QUALITY_INTERVALS } from './chordQualities';

describe('generateChordCatalogue', () => {
  it('generates 12 roots x every quality of chords, all unique ids', () => {
    const { chords } = generateChordCatalogue();
    expect(Object.keys(QUALITY_INTERVALS)).toHaveLength(40);
    expect(chords).toHaveLength(12 * 40);
    expect(new Set(chords.map((c) => c.id)).size).toBe(480);
  });

  it('builds C major as [60, 64, 67]', () => {
    const { chords } = generateChordCatalogue();
    const cMaj = chords.find((c) => c.id === 'C-maj');
    expect(cMaj?.midiNotes).toEqual([60, 64, 67]);
    expect(cMaj?.root).toBe(0);
  });

  it('builds C dominant 7th as [60, 64, 67, 70]', () => {
    const { chords } = generateChordCatalogue();
    const cDom7 = chords.find((c) => c.id === 'C-dom7');
    expect(cDom7?.midiNotes).toEqual([60, 64, 67, 70]);
  });

  it('scores the diatonic triads of C major correctly (I ii iii IV V vi vii°)', () => {
    const { progressions, chords } = generateChordCatalogue();
    const iVviIV = progressions.find((p) => p.id === 'C-I-V-vi-IV')!;
    expect(iVviIV.chordIds).toEqual(['C-maj', 'G-maj', 'A-min', 'F-maj']);
    expect(iVviIV.mode).toBe('major');
    // sanity: every id referenced actually exists in the chord list
    for (const id of iVviIV.chordIds) {
      expect(chords.some((c) => c.id === id)).toBe(true);
    }
  });

  it('generates ii-V-I and a 12-bar-blues turnaround for every one of the 12 keys', () => {
    const { progressions } = generateChordCatalogue();
    // 12 keys x (1 hand-authored 12-bar-blues + 50 major + 58 minor + 82 modal)
    expect(progressions).toHaveLength(12 * 191);
    const gIIVI = progressions.find((p) => p.id === 'G-ii-V-I')!;
    expect(gIIVI.chordIds).toEqual(['A-min', 'D-maj', 'G-maj']);
  });

  it('transposes the same progression shape across keys', () => {
    const { progressions } = generateChordCatalogue();
    const cBlues = progressions.find((p) => p.id === 'C-12-bar-blues (turnaround)')!;
    const gBlues = progressions.find((p) => p.id === 'G-12-bar-blues (turnaround)')!;
    expect(cBlues.chordIds).toHaveLength(gBlues.chordIds.length);
    expect(cBlues.moods).toEqual(['Blues']);
  });

  it('carries ported mood tags onto generated progressions', () => {
    const { progressions } = generateChordCatalogue();
    const p = progressions.find((p) => p.id === 'C-I-V-vi-IV')!;
    expect(p.moods.length).toBeGreaterThan(0);
  });

  it('builds a minor-key progression with the natural-minor scale', () => {
    const { progressions, chords } = generateChordCatalogue();
    // "i iv v" -> A minor: i=A-min, iv=D-min, v=E-min
    const aMinor = progressions.find((p) => p.id === 'A-i-iv-v')!;
    expect(aMinor.mode).toBe('minor');
    expect(aMinor.chordIds).toEqual(['A-min', 'D-min', 'E-min']);
    for (const id of aMinor.chordIds) {
      expect(chords.some((c) => c.id === id)).toBe(true);
    }
  });
});

describe('parseDegreeToken', () => {
  it('reads a bare uppercase numeral as a major triad', () => {
    expect(parseDegreeToken('IV')).toEqual({ degreeIndex: 3, accidentalOffset: 0, quality: 'maj' });
  });

  it('reads a bare lowercase numeral as a minor triad', () => {
    expect(parseDegreeToken('vi')).toEqual({ degreeIndex: 5, accidentalOffset: 0, quality: 'min' });
  });

  it('parses every quality suffix used by the ported free-midi-chords data', () => {
    expect(parseDegreeToken('V5')).toEqual({ degreeIndex: 4, accidentalOffset: 0, quality: 'five' });
    expect(parseDegreeToken('IV6')).toEqual({ degreeIndex: 3, accidentalOffset: 0, quality: 'maj6' });
    expect(parseDegreeToken('vi6')).toEqual({ degreeIndex: 5, accidentalOffset: 0, quality: 'min6' });
    expect(parseDegreeToken('VI69')).toEqual({ degreeIndex: 5, accidentalOffset: 0, quality: 'maj69' });
    expect(parseDegreeToken('I7')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'dom7' });
    expect(parseDegreeToken('iv7')).toEqual({ degreeIndex: 3, accidentalOffset: 0, quality: 'min7' });
    expect(parseDegreeToken('IM-5')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'majFlat5' });
    expect(parseDegreeToken('Iadd9')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'majAdd9' });
    expect(parseDegreeToken('viadd9')).toEqual({ degreeIndex: 5, accidentalOffset: 0, quality: 'minAdd9' });
    expect(parseDegreeToken('vdim')).toEqual({ degreeIndex: 4, accidentalOffset: 0, quality: 'dim' });
    expect(parseDegreeToken('Idom7')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'dom7' });
    expect(parseDegreeToken('iim7')).toEqual({ degreeIndex: 1, accidentalOffset: 0, quality: 'min7' });
    expect(parseDegreeToken('Isus2')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'sus2' });
    expect(parseDegreeToken('Vsus4')).toEqual({ degreeIndex: 4, accidentalOffset: 0, quality: 'sus4' });
  });

  it('reads the borrowed-degree tokens of the modal set', () => {
    expect(parseDegreeToken('bIIIM')).toEqual({ degreeIndex: 2, accidentalOffset: -1, quality: 'maj' });
    expect(parseDegreeToken('#IVm')).toEqual({ degreeIndex: 3, accidentalOffset: 1, quality: 'min' });
    expect(parseDegreeToken('ivm9')).toEqual({ degreeIndex: 3, accidentalOffset: 0, quality: 'min9' });
    expect(parseDegreeToken('bVIM7')).toEqual({ degreeIndex: 5, accidentalOffset: -1, quality: 'maj7' });
    expect(parseDegreeToken('bIIM7')).toEqual({ degreeIndex: 1, accidentalOffset: -1, quality: 'maj7' });
    expect(parseDegreeToken('I9')).toEqual({ degreeIndex: 0, accidentalOffset: 0, quality: 'dom9' });
  });

  it('rejects an unrecognised numeral or suffix', () => {
    expect(() => parseDegreeToken('xyz')).toThrow();
    expect(() => parseDegreeToken('Iwobble')).toThrow();
  });
});

describe('modal progressions', () => {
  it('ships all 82 modal progressions in all 12 keys, ids unique across the whole catalogue', () => {
    const { progressions } = generateChordCatalogue();
    expect(progressions.filter((p) => p.mode === 'modal')).toHaveLength(82 * 12);
    expect(progressions.filter((p) => p.mode === 'major')).toHaveLength(50 * 12 + 12); // + the 12-bar blues
    expect(progressions.filter((p) => p.mode === 'minor')).toHaveLength(58 * 12);
    expect(new Set(progressions.map((p) => p.id)).size).toBe(progressions.length);
  });

  it('numbers modal degrees off the major scale: C "bIIIM bVIIM IV" is Eb, Bb, F', () => {
    const { progressions } = generateChordCatalogue();
    const p = progressions.find((x) => x.id === 'C-modal:I-bIIIM-bVIIM-IV');
    expect(p?.chordIds).toEqual(['C-maj', 'D#-maj', 'A#-maj', 'F-maj']);
  });

  it('keeps every modal chord inside the catalogue', () => {
    const { chords, progressions } = generateChordCatalogue();
    const ids = new Set(chords.map((c) => c.id));
    for (const p of progressions) for (const id of p.chordIds) expect(ids.has(id)).toBe(true);
  });
});
