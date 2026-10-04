import { describe, expect, it } from 'vitest';
import { asPitchClass, type ProgressionEntry } from './chordTypes';
import { easyMoods, isEasyProgression, pickFreePlay } from './freePlay';

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
