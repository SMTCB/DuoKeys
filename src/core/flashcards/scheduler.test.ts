import { describe, expect, it } from 'vitest';
import { reviewCard, INTERVAL_BY_BOX } from './scheduler';
import type { Flashcard } from '../data/flashcard';
import { asMidiPitch } from '../midi/decode';
import { asMillis } from '../time/types';

function card(box: Flashcard['box']): Flashcard {
  return { profileId: 'p1', cardId: 'C4', pitch: asMidiPitch(60), box, dueAtMs: asMillis(0) };
}

describe('reviewCard', () => {
  it('advances a box on a fast response, capped at 5', () => {
    expect(reviewCard(card(1), 'fast', 0).box).toBe(2);
    expect(reviewCard(card(5), 'fast', 0).box).toBe(5);
  });

  it('leaves the box unchanged on correct or hinted', () => {
    expect(reviewCard(card(3), 'correct', 0).box).toBe(3);
    expect(reviewCard(card(3), 'hinted', 0).box).toBe(3);
  });

  it('resets to box 1 on wrong', () => {
    expect(reviewCard(card(4), 'wrong', 0).box).toBe(1);
  });

  it('schedules dueAtMs from the box interval', () => {
    const reviewed = reviewCard(card(1), 'fast', 1_000);
    expect(reviewed.dueAtMs).toBe(1_000 + (INTERVAL_BY_BOX[2] as number));
  });
});
