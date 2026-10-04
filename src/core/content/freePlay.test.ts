import { describe, expect, it } from 'vitest';
import { asPitchClass, type ProgressionEntry } from './chordTypes';
import { easyMoods, isEasyProgression, pickFreePlay, sameProgressionInKey } from './freePlay';

const prog = (id: string, chordIds: string[], moods: string[], mode: 'major' | 'minor' = 'major'): ProgressionEntry => ({
  id,
  name: id,
  key: asPitchClass(mode === 'major' ? 0 : 9),
  mode,
  moods,
  chordIds,
  suggestedBpm: 90,
});

const EASY = prog('a', ['C-maj', 'G-maj', 'A-min', 'F-maj'], ['Relaxed']);
const HARD = prog('b', ['C-maj', 'D-dim', 'E-aug', 'F-maj', 'G-maj'], ['Relaxed']);
const OTHER = prog('c', ['C-maj', 'F-maj'], ['Joyful']);

describe('isEasyProgression', () => {
  it('accepts few plain chords and rejects many or unusual ones', () => {
    expect(isEasyProgression(EASY)).toBe(true);
    expect(isEasyProgression(HARD)).toBe(false);
  });
});

describe('pickFreePlay', () => {
  it('only suggests easy progressions, narrowed by mood', () => {
    const s = pickFreePlay([EASY, HARD, OTHER], { mood: 'Relaxed' }, () => 0);
    expect(s?.progression.id).toBe('a');
  });
  it('falls back to the whole easy pool when the mood has none', () => {
    const s = pickFreePlay([EASY, OTHER], { mood: 'Mysterious' }, () => 0.99);
    expect(s?.progression.id).toBe('c');
  });
  it('avoids repeating the last pick when it can', () => {
    const s = pickFreePlay([EASY, OTHER], { avoidId: 'a' }, () => 0);
    expect(s?.progression.id).toBe('c');
  });
  it('is deterministic for a given draw and returns nothing for an empty pool', () => {
    expect(pickFreePlay([EASY, OTHER], {}, () => 0.3)).toEqual(pickFreePlay([EASY, OTHER], {}, () => 0.3));
    expect(pickFreePlay([HARD], {}, () => 0)).toBeUndefined();
  });
});

describe('easyMoods', () => {
  it('lists moods of easy progressions only', () => {
    expect(easyMoods([EASY, HARD, OTHER])).toEqual(['Joyful', 'Relaxed']);
  });
});

describe('key choice', () => {
  // TS-U-CNT-045
  const inKey = (key: number): ProgressionEntry => ({ ...EASY, id: `k${key}`, name: 'I-V-vi-IV', key: asPitchClass(key) });
  const all = [inKey(0), inKey(2), inKey(7), { ...OTHER, name: 'I-IV', key: asPitchClass(2) }];

  it('pickFreePlay stays in the chosen key', () => {
    expect(pickFreePlay(all, { key: asPitchClass(7) }, () => 0)?.progression.id).toBe('k7');
    expect(pickFreePlay(all, { key: asPitchClass(5) }, () => 0)).toBeUndefined();
  });

  it('sameProgressionInKey finds the same degrees in another key, and nothing for typed-in ones', () => {
    expect(sameProgressionInKey(all, inKey(0), asPitchClass(2))?.id).toBe('k2');
    expect(sameProgressionInKey(all, inKey(0), asPitchClass(5))).toBeUndefined();
    expect(sameProgressionInKey(all, { ...inKey(0), isUserAdded: true }, asPitchClass(2))).toBeUndefined();
  });
});
