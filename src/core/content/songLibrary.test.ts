// TS-U-CNT-028, TS-U-CNT-029 — song search and the SMF-to-arrangement conversion; every mirrored Mutopia file converts.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSmf } from '../midi/smf';
import { isMonophonic, normaliseForSearch, searchSongs, smfToArrangement, stylesOf, type SongEntry } from './songLibrary';

const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number): number[] => [(n >>> 8) & 255, n & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
function smf(tracks: number[][], division = 480): Uint8Array {
  const out = [...ascii('MThd'), ...be32(6), ...be16(1), ...be16(tracks.length), ...be16(division)];
  for (const t of tracks) out.push(...ascii('MTrk'), ...be32(t.length), ...t);
  return new Uint8Array(out);
}
const END = [0x00, 0xff, 0x2f, 0x00];
/** note on at delta 0, off after `len` ticks (len < 128). */
const note = (pitch: number, len: number): number[] => [0x00, 0x90, pitch, 90, len, 0x80, pitch, 0];

function parsed(bytes: Uint8Array) {
  const r = parseSmf(bytes);
  if (!r.ok) throw new Error(r.error);
  return r.file;
}

const song = (over: Partial<SongEntry>): SongEntry => ({
  id: 'mutopia-1',
  title: 'Prelude',
  composer: 'F. F. Chopin (1810–1849)',
  opus: '28',
  style: 'Romantic',
  instrument: 'Piano',
  licenceId: 'mutopia-1',
  licenceLabel: 'Public Domain',
  licenceUrl: '',
  sourceUrl: '',
  noteCount: 1,
  bars: 1,
  bpm: 100,
  ...over,
});

describe('search', () => {
  const songs = [
    song({ id: 'a', title: 'Étude in C', composer: 'C. Czerny (1791–1857)', style: 'Technique' }),
    song({ id: 'b', title: 'Prelude in C', composer: 'J. S. Bach (1685–1750)', opus: 'BWV 846', style: 'Baroque' }),
    song({ id: 'c', title: 'Nocturne', composer: 'F. F. Chopin (1810–1849)', opus: '9', style: 'Romantic' }),
  ];

  it('ignores accents and punctuation', () => {
    expect(normaliseForSearch('Étude, in C!')).toBe('etude in c');
    expect(searchSongs(songs, { text: 'etude' }).map((s) => s.id)).toEqual(['a']);
  });

  it('needs every word, across title, composer and opus', () => {
    expect(searchSongs(songs, { text: 'bach prelude' }).map((s) => s.id)).toEqual(['b']);
    expect(searchSongs(songs, { text: 'prelude chopin' })).toEqual([]);
    expect(searchSongs(songs, { text: 'bwv 846' }).map((s) => s.id)).toEqual(['b']);
  });

  it('filters by style and lists the styles present', () => {
    expect(searchSongs(songs, { style: 'Romantic' }).map((s) => s.id)).toEqual(['c']);
    expect(searchSongs(songs, {}).length).toBe(3);
    expect(stylesOf(songs)).toEqual(['Baroque', 'Romantic', 'Technique']);
  });
});

describe('smfToArrangement', () => {
  it('reads two note tracks as right then left hand and adds a both-hands track', () => {
    const right = [...note(72, 100), ...note(74, 100), ...END];
    const left = [...note(48, 100), ...END];
    const a = smfToArrangement(parsed(smf([right, left])), { id: 'mutopia-1', title: 'T' });
    expect(a?.tracks.map((t) => t.id)).toEqual(['both', 'rh', 'lh']);
    expect(a?.tracks[1]?.notes).toHaveLength(2);
    expect(a?.tracks[2]?.notes.map((n) => n.pitch)).toEqual([48]);
    expect(a?.tracks[0]?.notes).toHaveLength(3);
  });

  it('puts notes that begin together in one group, across hands', () => {
    const right = [...note(72, 60), ...END];
    const left = [...note(48, 60), ...END];
    const a = smfToArrangement(parsed(smf([right, left])), { id: 'x', title: 'T' });
    const groups = new Set(a?.tracks[0]?.notes.map((n) => n.groupId));
    expect(groups.size).toBe(1);
  });

  it('splits a single track at middle C, and omits hand tracks when one hand has nothing', () => {
    const one = [...note(72, 60), ...note(48, 60), ...END];
    expect(smfToArrangement(parsed(smf([one])), { id: 'x', title: 'T' })?.tracks.map((t) => t.id)).toEqual(['both', 'rh', 'lh']);
    const high = [...note(72, 60), ...note(74, 60), ...END];
    expect(smfToArrangement(parsed(smf([high])), { id: 'x', title: 'T' })?.tracks.map((t) => t.id)).toEqual(['both']);
  });

  it('scales ticks to the app grid and keeps the tempo', () => {
    const tempo = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, ...note(60, 100), ...END]; // 500 000 µs = 120 bpm
    const a = smfToArrangement(parsed(smf([tempo], 96)), { id: 'x', title: 'T' });
    expect(a?.tempoMap[0]?.bpm).toBe(120);
    expect(a?.tracks[0]?.notes[0]?.durationTicks).toBe(500); // 100 ticks at 96 tpq -> 480 ppq
  });

  it('declines a file with no notes', () => {
    expect(smfToArrangement(parsed(smf([END])), { id: 'x', title: 'T' })).toBeUndefined();
  });

  it('says whether a track is a single line', () => {
    const line = smfToArrangement(parsed(smf([[...note(72, 60), 0x10, 0x90, 74, 90, 20, 0x80, 74, 0, ...END]])), { id: 'x', title: 'T' });
    expect(isMonophonic(line!.tracks[0]!)).toBe(true);
    const chord = smfToArrangement(parsed(smf([[0x00, 0x90, 60, 90, 0x00, 0x90, 64, 90, 40, 0x80, 60, 0, 0x00, 0x80, 64, 0, ...END]])), { id: 'x', title: 'T' });
    expect(isMonophonic(chord!.tracks[0]!)).toBe(false);
  });
});

describe('every mirrored Mutopia file', () => {
  const dir = resolve(__dirname, '../../../content/sources/mutopia/mid');
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.mid'));
  } catch {
    files = [];
  }

  it.skipIf(files.length === 0)('parses and becomes an arrangement', () => {
    const failures: string[] = [];
    for (const f of files) {
      const r = parseSmf(new Uint8Array(readFileSync(resolve(dir, f))));
      if (!r.ok) {
        failures.push(`${f}: ${r.error}`);
        continue;
      }
      if (!smfToArrangement(r.file, { id: f, title: f })) failures.push(`${f}: no notes`);
    }
    expect(failures).toEqual([]);
  });
});
