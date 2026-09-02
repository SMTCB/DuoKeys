// TA-REN-002 — pitch->x mapping. Pure and unit-tested (TS-U-REN-*) per
// docs/01-TECHNICAL-ARCHITECTURE.md: white keys tile uniformly, black keys are
// inset and overlap their neighbours, the pattern repeats every octave with a
// 2-3 grouping. Derived once from Profile.keyboardRange so a smaller keybed
// (kept as a safety net, ADR-009) renders correctly if one is ever used.
//
// core/ imports nothing but core/ (TA-PORT-001); this lives in ui/ because it
// is a rendering concern (screen x, not a musical quantity), even though it
// has no DOM/React dependency and is tested the same way a core/ module is.

import type { MidiPitch } from '../../core/midi/decode';

const PITCH_CLASS_IS_WHITE: readonly boolean[] = [
  true, // C
  false, // C#
  true, // D
  false, // D#
  true, // E
  true, // F
  false, // F#
  true, // G
  false, // G#
  true, // A
  false, // A#
  true, // B
];

// Fraction of one white-key width that each black key sits to the right of
// the white key immediately to its left — reproduces the printed keybed's
// 2-3 grouping (C#/D# cluster near D; F#/G#/A# cluster near G).
const BLACK_KEY_INSET: Readonly<Record<number, number>> = {
  1: 0.65, // C#
  3: 0.35, // D#
  6: 0.7, // F#
  8: 0.5, // G#
  10: 0.3, // A#
};

export const BLACK_KEY_WIDTH_UNITS = 0.6;

export interface KeyboardRange {
  low: MidiPitch;
  high: MidiPitch;
}

export interface PitchXResult {
  /** Left edge, in white-key-width units (multiply by a pixel width to render). */
  x: number;
  isWhite: boolean;
  /** 1 for a white key, BLACK_KEY_WIDTH_UNITS for a black key. */
  widthUnits: number;
}

function pitchClassOf(pitch: number): number {
  return ((pitch % 12) + 12) % 12;
}

/** Count of white keys in [low, pitch) — i.e. strictly below `pitch`. */
function whiteKeysBefore(pitch: number, low: number): number {
  let count = 0;
  for (let p = low; p < pitch; p++) {
    if (PITCH_CLASS_IS_WHITE[pitchClassOf(p)]) count++;
  }
  return count;
}

export function pitchToX(pitch: MidiPitch, range: KeyboardRange): PitchXResult {
  const p = pitch as number;
  const low = range.low as number;
  const pitchClass = pitchClassOf(p);
  const whiteKeysBeforeThis = whiteKeysBefore(p, low);

  if (PITCH_CLASS_IS_WHITE[pitchClass]) {
    return { x: whiteKeysBeforeThis, isWhite: true, widthUnits: 1 };
  }

  const inset = BLACK_KEY_INSET[pitchClass] ?? 0.5;
  return { x: whiteKeysBeforeThis - 1 + inset, isWhite: false, widthUnits: BLACK_KEY_WIDTH_UNITS };
}
