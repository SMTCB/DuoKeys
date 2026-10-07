// TS-U-CNT-051 — key detection and transposition.
import { describe, expect, it } from 'vitest';
import { detectKey, keyName } from './detectKey';
import { transposeArrangement, transposeLimits } from './transpose';
import type { Arrangement, ContentNote } from './types';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';

function arrangementOf(pitches: number[]): Arrangement {
  const notes: ContentNote[] = pitches.map((p, i) => ({
    id: `n${i}`,
    pitch: asMidiPitch(p),
    startTick: asTicks(i * 480),
    durationTicks: asTicks(480),
    groupId: `g${i}`,
    trackId: 't',
  }));
  return {
    id: 'a',
    pieceId: 'p',
    difficulty: 1,
    tempoMap: [] as never,
    timeSig: [4, 4],
    keySig: 'C',
    tracks: [{ id: 't', role: 'melody', notes }],
    sections: [],
    analysis: {} as never,
  };
}

describe('detectKey (TS-U-CNT-051)', () => {
  it('finds G major from a G major scale and tune', () => {
    const key = detectKey(arrangementOf([67, 69, 71, 72, 74, 76, 78, 79, 74, 71, 67, 71, 74, 67]));
    expect(key?.name).toBe('G major');
  });
  it('finds A minor from an A minor tune', () => {
    const key = detectKey(arrangementOf([69, 72, 76, 69, 71, 74, 77, 76, 72, 69, 68, 76, 69]));
    expect(key?.name).toBe('A minor');
  });
  it('says nothing about a handful of notes', () => {
    expect(detectKey(arrangementOf([60, 62]))).toBeUndefined();
  });
  it('spells flat keys with flats', () => {
    expect(keyName(3, 'major')).toBe('Eb major');
    expect(keyName(6, 'major')).toBe('F# major');
  });
});

describe('transposeArrangement (TS-U-CNT-051)', () => {
  it('moves every note and leaves the original alone', () => {
    const a = arrangementOf([60, 64, 67, 72]);
    const up = transposeArrangement(a, 2);
    expect(up.tracks[0]?.notes.map((n) => n.pitch)).toEqual([62, 66, 69, 74]);
    expect(a.tracks[0]?.notes[0]?.pitch).toBe(60);
    expect(transposeArrangement(a, 0)).toBe(a);
  });
  it('reports how far it can go before leaving the keyboard', () => {
    expect(transposeLimits(arrangementOf([24, 100]), 21, 108)).toEqual({ down: -3, up: 8 });
  });
});
