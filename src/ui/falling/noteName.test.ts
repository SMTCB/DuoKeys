import { describe, expect, it } from 'vitest';
import { noteName } from './noteName';

describe('noteName', () => {
  it('names middle C as C4 and the octave below as B3', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(59)).toBe('B3');
  });
  it('spells black keys with a sharp, and can drop the octave', () => {
    expect(noteName(66)).toBe('F#4');
    expect(noteName(47, false)).toBe('B');
  });
});
