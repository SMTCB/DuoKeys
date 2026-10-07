// FR-STU-016 / TA-REN-003 — the same piece, every note moved by a number of semitones.

import type { Arrangement } from './types';
import { asMidiPitch } from '../midi/decode';

/** The semitone moves that keep every note on the keyboard (low…high are MIDI pitches). */
export function transposeLimits(arrangement: Arrangement, low: number, high: number): { down: number; up: number } {
  let lowest = Infinity;
  let highest = -Infinity;
  for (const track of arrangement.tracks) {
    for (const note of track.notes) {
      lowest = Math.min(lowest, note.pitch as number);
      highest = Math.max(highest, note.pitch as number);
    }
  }
  if (lowest === Infinity) return { down: 0, up: 0 };
  return { down: Math.min(0, low - lowest), up: Math.max(0, high - highest) };
}

export function transposeArrangement(arrangement: Arrangement, semitones: number): Arrangement {
  if (semitones === 0) return arrangement;
  return {
    ...arrangement,
    tracks: arrangement.tracks.map((track) => ({
      ...track,
      notes: track.notes.map((note) => ({ ...note, pitch: asMidiPitch((note.pitch as number) + semitones) })),
    })),
  };
}
