// US-2.13 — Note Ninja's card pool. Five-finger C position (C4..G4), the
// same beginner range as the difficulty-1 catalogue (TS-U-CNT-017). No
// Flashcard persistence type here: spaced-repetition scheduling is US-2.14's
// scope, not this slice's — see docs/03-SPRINT-PLAN.md.

import type { MidiPitch } from '../midi/decode';
import { noteNameToMidiPitch } from '../content/noteName';

export const NOTE_NINJA_POOL: readonly MidiPitch[] = ['C4', 'D4', 'E4', 'F4', 'G4'].map(
  noteNameToMidiPitch,
);

/**
 * Picks the next card at random, never immediately repeating `exclude` (ADR-005:
 * randomness is injected, never called from core — the runtime layer supplies
 * Math.random).
 */
export function drawNextCard(
  pool: readonly MidiPitch[],
  exclude: MidiPitch | undefined,
  random: () => number,
): MidiPitch {
  const choices = pool.length > 1 ? pool.filter((p) => p !== exclude) : pool;
  const index = Math.floor(random() * choices.length);
  return choices[index]!;
}
