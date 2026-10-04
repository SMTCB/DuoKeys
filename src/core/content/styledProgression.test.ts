import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSmf } from '../midi/smf';
import { generateChordCatalogue } from './chordCatalogue';
import { styleFilePath, styleKeyOffset, styledProgressionToArrangement } from './styledProgression';

const { chords, progressions } = generateChordCatalogue();
const stylesDir = resolve(__dirname, '../../../content/chord-styles');
const find = (id: string) => progressions.find((p) => p.id === id)!;

function load(path: string) {
  const parsed = parseSmf(new Uint8Array(readFileSync(resolve(stylesDir, path))));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.file;
}

describe('styleKeyOffset', () => {
  it('is 0 in the reference key and folds to -6..+5', () => {
    expect(styleKeyOffset(find('C-I-V-vi-IV'))).toBe(0);
    expect(styleKeyOffset(find('A-i-iv-v'))).toBe(0);
    expect(styleKeyOffset(find('G-I-V-vi-IV'))).toBe(-5);
    expect(styleKeyOffset(find('F#-I-V-vi-IV'))).toBe(-6);
    expect(styleKeyOffset(find('D-I-V-vi-IV'))).toBe(2);
  });
});

describe('styleFilePath', () => {
  it('names the file, marks a repeated modal sequence and has none for the blues', () => {
    expect(styleFilePath('pop', find('C-I-V-vi-IV'))).toBe('pop/major/I-V-vi-IV.mid');
    expect(styleFilePath('soul', find('C-modal:im-bVIIM-IV-im~2'))).toBe('soul/modal/im-bVIIM-IV-im~2.mid');
    expect(styleFilePath('pop', find('C-12-bar-blues (turnaround)'))).toBeUndefined();
  });

  it('points at a bundled file for every non-blues progression in every style', () => {
    const have = new Set(['pop', 'pop2', 'soul', 'hiphop2'].flatMap((s) => ['major', 'minor', 'modal'].flatMap((m) => readdirSync(resolve(stylesDir, s, m)).map((f) => `${s}/${m}/${f}`))));
    for (const p of progressions) {
      for (const s of ['pop', 'pop2', 'soul', 'hiphop2'] as const) {
        const path = styleFilePath(s, p);
        if (path) expect(have.has(path), path).toBe(true);
      }
    }
  });
});

describe('styledProgressionToArrangement', () => {
  const prog = find('C-I-V-vi-IV');
  const file = load('pop/major/I-V-vi-IV.mid');
  const arrangement = styledProgressionToArrangement(prog, chords, file, 2)!;

  it('keeps the file tempo and one marker per chord per pass', () => {
    expect(arrangement.tempoMap[0]?.bpm).toBe(80);
    expect(arrangement.chordMarkers?.map((m) => m.symbol)).toEqual(['C', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F']);
  });

  it('puts simultaneous notes in one group, on the PPQ grid', () => {
    const notes = arrangement.tracks[0]!.notes;
    const first = notes.filter((n) => n.startTick === 0);
    expect(first.length).toBeGreaterThan(2);
    expect(new Set(first.map((n) => n.groupId)).size).toBe(1);
    expect(arrangement.sections[0]?.endTick).toBe(2 * 2 * 4 * 480);
  });

  it('transposes by the key offset', () => {
    const inD = styledProgressionToArrangement(find('D-I-V-vi-IV'), chords, file, 1)!;
    const inC = styledProgressionToArrangement(prog, chords, file, 1)!;
    expect(inD.tracks[0]!.notes.map((n) => (n.pitch as number) - 2)).toEqual(inC.tracks[0]!.notes.map((n) => n.pitch as number));
  });

  it('declines a file with no notes', () => {
    expect(styledProgressionToArrangement(prog, chords, { ...file, notes: [] }, 1)).toBeUndefined();
  });
});

describe('styledProgressionToArrangement chord assignment', () => {
  // TS-U-CNT-044 — the three-chord loop changes chord at uneven moments, so equal time slices mislabelled F as C.
  it('puts each chord marker on notes of that chord, even when the chords are not evenly spaced', () => {
    const prog = find('C-I-IV-V');
    const arrangement = styledProgressionToArrangement(prog, chords, load('pop/major/I-IV-V.mid'), 1)!;
    const byId = new Map(chords.map((c) => [c.id, c]));
    const markers = arrangement.chordMarkers!;
    expect(markers.map((m) => m.symbol)).toEqual(['C', 'F', 'G']);
    const notes = arrangement.tracks[0]!.notes;
    markers.forEach((m, i) => {
      const next = markers[i + 1]?.atTick ?? Number.POSITIVE_INFINITY;
      const wanted = new Set(byId.get(prog.chordIds[i]!)!.midiNotes.map((p) => (p as number) % 12));
      const inSegment = notes.filter((n) => (n.startTick as number) >= (m.atTick as number) && (n.startTick as number) < (next as number));
      expect(inSegment.length).toBeGreaterThan(0);
      for (const n of inSegment) expect(wanted.has((n.pitch as number) % 12), `${m.symbol} ${n.pitch}`).toBe(true);
    });
  });
});
