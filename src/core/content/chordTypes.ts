// TA-CNT-006 — chord & progression content. Deliberately separate from
// Piece/Arrangement (TA-DAT-001): this content has no Section, no hand
// role, no difficulty score, so it does not flow through TA-CNT-001's
// stages 4-6 and does not become a Piece/Arrangement.

export type PitchClass = number & { readonly __brand: 'PitchClass' };
export const asPitchClass = (n: number): PitchClass => (((n % 12) + 12) % 12) as PitchClass;

import type { MidiPitch } from '../midi/decode';

export interface ChordEntry {
  id: string; // e.g. "C-maj7"
  root: PitchClass;
  quality: string; // "maj", "min7", "dom7", ...
  midiNotes: MidiPitch[]; // one voicing
}

export interface ProgressionEntry {
  id: string;
  name: string; // "I-V-vi-IV"
  key: PitchClass;
  mode: 'major' | 'minor';
  moods: readonly string[]; // e.g. ["Hopeful", "Romantic"]
  chordIds: string[]; // in order
  suggestedBpm: number;
}

export interface ChordIndex {
  chords: ChordEntry[];
  progressions: ProgressionEntry[];
}
