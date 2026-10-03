import { describe, expect, it } from 'vitest';
import { rememberedInputFirst, withMidiInput } from './midiPreference';
import type { Profile } from './types';

const profile: Profile = {
  id: 'p1',
  displayName: 'Mia',
  role: 'explorer',
  keyboardRange: { low: 21, high: 108 },
  latencyOffsetMs: 0,
  toleranceScale: 1,
  avatar: 'piano',
} as Profile;

describe('rememberedInputFirst', () => {
  const inputs = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('moves the remembered input to the front and keeps the rest in order', () => {
    expect(rememberedInputFirst(inputs, 'c').map((i) => i.id)).toEqual(['c', 'a', 'b']);
  });
  it('leaves the order alone when nothing is remembered or the input is absent', () => {
    expect(rememberedInputFirst(inputs, undefined)).toEqual(inputs);
    expect(rememberedInputFirst(inputs, 'gone')).toEqual(inputs);
  });
});

describe('withMidiInput', () => {
  it('returns a new profile carrying the input id, or the same one if unchanged', () => {
    const next = withMidiInput(profile, 'x');
    expect(next.midiInputId).toBe('x');
    expect(withMidiInput(next, 'x')).toBe(next);
  });
});
