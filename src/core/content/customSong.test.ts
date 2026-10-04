import { describe, expect, it } from 'vitest';
import { chartToArrangement, customSongToArrangement, makeCustomSong, parseChordChart } from './customSong';

const CHART = `[Verse 1]
Em7        G
Today is gonna be the day
Dsus4      A7sus4
That they are gonna throw it back to you

[Chorus]
C   D   Em
And all the roads we have to walk are winding
`;

describe('parseChordChart', () => {
  it('keeps chord lines, skips lyrics, notes sections', () => {
    const c = parseChordChart(CHART);
    expect(c.chordIds).toEqual(['E-min7', 'G-maj', 'D-sus4', 'A-dom7sus4', 'C-maj', 'D-maj', 'E-min']);
    expect(c.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus']);
    expect(c.sections[1]?.startIndex).toBe(4);
    expect(c.unsupported).toEqual([]);
  });
  it('reports unreadable chord-shaped tokens', () => {
    expect(parseChordChart('C  Cxyz  G').unsupported).toEqual(['Cxyz']);
  });
});

describe('chartToArrangement', () => {
  it('builds one bar per chord with the chart sections', () => {
    const a = chartToArrangement({ id: 'custom:x', title: 'Wonderwall' }, parseChordChart(CHART));
    expect(a?.id).toBe('custom:x');
    expect(a?.chordMarkers).toHaveLength(7);
    expect(a?.sections.map((s) => s.label)).toEqual(['Verse 1', 'Chorus']);
  });
  it('returns undefined with no chords', () => {
    expect(chartToArrangement({ id: 'custom:x', title: 't' }, parseChordChart('just words here'))).toBeUndefined();
  });
});

describe('makeCustomSong / customSongToArrangement', () => {
  it('rejects a nameless song and a chordless chart', () => {
    expect(makeCustomSong({ id: '1', title: ' ', artist: '', kind: 'chart', data: 'C G', addedAtMs: 0 }).ok).toBe(false);
    expect(makeCustomSong({ id: '1', title: 'x', artist: '', kind: 'chart', data: 'la la', addedAtMs: 0 }).ok).toBe(false);
  });
  it('round-trips a chart', () => {
    const made = makeCustomSong({ id: '1', title: 'Wonderwall', artist: 'Oasis', kind: 'chart', data: CHART, addedAtMs: 5 });
    if (!made.ok) throw new Error(made.error);
    expect(made.song.id).toBe('custom:1');
    expect(customSongToArrangement(made.song).ok).toBe(true);
  });
});
