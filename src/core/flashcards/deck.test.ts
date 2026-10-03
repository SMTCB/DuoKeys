import { describe, expect, it } from 'vitest';
import { asMidiPitch } from '../midi/decode';
import { drawNextCard, NOTE_NINJA_POOL } from './deck';

// TS-U-GRD-014
describe('drawNextCard', () => {
  it('is deterministic under an injected random source', () => {
    const random = () => 0;
    expect(drawNextCard(NOTE_NINJA_POOL, undefined, random)).toBe(NOTE_NINJA_POOL[0]);
  });

  it('never repeats the immediately-previous card', () => {
    const previous = NOTE_NINJA_POOL[0]!;
    // Even a random source that always wants index 0 of the full pool must
    // land on something other than `previous` once it's excluded.
    const random = () => 0;
    const next = drawNextCard(NOTE_NINJA_POOL, previous, random);
    expect(next).not.toBe(previous);
  });

  it('falls back to repeating when the pool has only one card', () => {
    const only = [asMidiPitch(60)];
    expect(drawNextCard(only, only[0], () => 0)).toBe(only[0]);
  });
});
