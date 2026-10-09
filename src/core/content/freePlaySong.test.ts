import { describe, expect, it } from 'vitest';
import { PPQ } from '../time/types';
import { generateChordCatalogue } from './chordCatalogue';
import { asPitchClass } from './chordTypes';
import { composeSong, fitPitchClasses, harmonyAt, partAt, songProgressions, type FreePlaySong, type SongRequest } from './freePlaySong';
import type { ContentNote } from './types';

const catalogue = generateChordCatalogue();
const request = (overrides: Partial<SongRequest> = {}): SongRequest => ({ length: 'song', level: 1, seed: 7, ...overrides });
const compose = (overrides: Partial<SongRequest> = {}): FreePlaySong => {
  const song = composeSong(catalogue, request(overrides));
  if (!song) throw new Error('no song');
  return song;
};
const track = (song: FreePlaySong, id: string): readonly ContentNote[] => song.arrangement.tracks.find((t) => t.id === id)?.notes ?? [];
const endTick = (song: FreePlaySong): number => (song.parts[song.parts.length - 1]?.endTick as number) ?? 0;
const minutes = (song: FreePlaySong): number => endTick(song) / PPQ / song.bpm;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

describe('composeSong', () => {
  it('TS-U-CNT-053: writes the same song for the same seed and a different one for another seed', () => {
    expect(compose({ seed: 42 })).toEqual(compose({ seed: 42 }));
    const titles = new Set(SEEDS.map((seed) => `${compose({ seed }).title}|${compose({ seed }).parts[1]?.progressionId}`));
    expect(titles.size).toBeGreaterThan(4);
  });

  it('TS-U-CNT-054: lays out intro, verses, choruses, a bridge and an ending that run for minutes', () => {
    const song = compose();
    expect(song.parts.map((p) => p.kind)).toEqual(['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'chorus', 'outro']);
    expect(song.arrangement.sections.map((s) => s.label)).toEqual(song.parts.map((p) => p.label));
    for (const seed of SEEDS) expect(minutes(compose({ seed }))).toBeGreaterThan(2);
    expect(minutes(compose({ length: 'short' }))).toBeLessThan(minutes(compose()));
    expect(minutes(compose({ length: 'long' }))).toBeGreaterThan(minutes(compose()));
    // The chorus and bridge are other progressions, in the verse's key.
    const verse = song.parts[1]!.progressionId;
    expect(song.parts[2]!.progressionId).not.toBe(verse);
    expect(new Set(song.parts.slice(1, -1).map((p) => p.progressionId.split('-')[0]))).toHaveLength(1);
    // The ending slows down.
    expect(song.arrangement.tempoMap[1]!.bpm).toBeLessThan(song.bpm);
  });

  it('TS-U-CNT-055: writes both hands, the left below middle C and the right above it, each key once per group', () => {
    for (const seed of SEEDS) {
      for (const level of [1, 2] as const) {
        const song = compose({ seed, level });
        const both = track(song, 'both');
        const rh = track(song, 'rh');
        const lh = track(song, 'lh');
        expect(both).toHaveLength(rh.length + lh.length);
        expect(lh.every((n) => (n.pitch as number) < 60)).toBe(true);
        expect(rh.every((n) => (n.pitch as number) >= 60 && (n.pitch as number) <= 79)).toBe(true);
        const slots = both.map((n) => `${n.groupId}:${n.pitch}`);
        expect(new Set(slots).size).toBe(slots.length);
        expect(both.every((n, i) => i === 0 || (n.startTick as number) >= (both[i - 1]!.startTick as number))).toBe(true);
        expect(both.every((n) => n.groupId === `t${n.startTick}`)).toBe(true);
      }
    }
  });

  it('TS-U-CNT-056: puts the tune on chord notes at the start of every bar and plays a returning section the same way', () => {
    for (const seed of SEEDS) {
      const song = compose({ seed });
      for (const n of track(song, 'rh')) {
        if ((n.startTick as number) % (PPQ * 4) !== 0) continue;
        const window = harmonyAt(song.harmony, n.startTick as number);
        expect(window?.chordPitchClasses).toContain((n.pitch as number) % 12);
      }
      const verses = song.parts.filter((p) => p.kind === 'verse');
      const tune = (from: number, to: number): string[] =>
        track(song, 'rh')
          .filter((n) => (n.startTick as number) >= from && (n.startTick as number) < to)
          .map((n) => `${(n.startTick as number) - from}:${n.pitch}`);
      expect(tune(verses[0]!.startTick, verses[0]!.endTick)).toEqual(tune(verses[1]!.startTick, verses[1]!.endTick));
    }
  });

  it('TS-U-CNT-057: keeps to the asked key and mood, and writes nothing from an empty catalogue', () => {
    const song = compose({ key: asPitchClass(7), mood: 'Sad' });
    expect(song.key).toBe(7);
    expect(song.moods).toContain('Sad');
    expect(song.bpm).toBe(72);
    expect(composeSong({ ...catalogue, progressions: [] }, request())).toBeUndefined();
    expect(songProgressions(catalogue.progressions).every((p) => [2, 3, 4, 8].includes(p.chordIds.length))).toBe(true);
  });
});

describe('notes that fit', () => {
  it('TS-U-CNT-058: lights the chord and the pentatonic notes that do not rub, bar by bar', () => {
    expect(fitPitchClasses('major', asPitchClass(0), [0, 4, 7])).toEqual([0, 2, 4, 7, 9]);
    // Over F: E sits a semitone under F, so it drops out and F joins.
    expect(fitPitchClasses('major', asPitchClass(0), [0, 5, 9])).toEqual([0, 2, 5, 7, 9]);
    expect(fitPitchClasses('minor', asPitchClass(9), [9, 0, 4])).toEqual([0, 2, 4, 7, 9]);
    const song = compose();
    expect(song.harmony).toHaveLength(endTick(song) / (PPQ * 4));
    expect(harmonyAt(song.harmony, 0)).toBe(song.harmony[0]);
    expect(harmonyAt(song.harmony, endTick(song))).toBeUndefined();
    expect(partAt(song.parts, PPQ * 4 * 5)?.kind).toBe('verse');
  });
});
