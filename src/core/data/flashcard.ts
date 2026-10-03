// TA-DAT-006 — Note Ninja's spaced-repetition pool. Persisted in the
// `flashcards` IndexedDB store (TA-DAT-003), keyed `profileId+cardId`.

import type { MidiPitch } from '../midi/decode';
import type { Millis } from '../time/types';

export type Box = 1 | 2 | 3 | 4 | 5;

export interface Flashcard {
  profileId: string;
  cardId: string; // the pitch's note name — stable, matches keyOf.ts
  pitch: MidiPitch;
  box: Box;
  dueAtMs: Millis;
}
