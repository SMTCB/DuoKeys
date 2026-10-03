// TA-CNT-001 — scientific pitch notation ("C4" = middle C, MIDI 60) parser for
// hand-authored content sources. Content is authored as note names for
// readability; everything downstream of ingest works in MidiPitch.

import { asMidiPitch, type MidiPitch } from '../midi/decode';

const PITCH_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const NOTE_NAME_RE = /^([A-Ga-g])([#b]?)(-?\d+)$/;

export function noteNameToMidiPitch(name: string): MidiPitch {
  const match = NOTE_NAME_RE.exec(name);
  if (!match) throw new Error(`noteName: "${name}" is not valid scientific pitch notation`);
  const [, letter, accidental, octaveStr] = match;
  const base = PITCH_CLASS[letter!.toUpperCase()]!;
  const offset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const octave = Number(octaveStr);
  return asMidiPitch((octave + 1) * 12 + base + offset);
}

const PITCH_CLASS_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Inverse of noteNameToMidiPitch, for UI display (Note Ninja's card label, US-2.13). */
export function midiPitchToNoteName(pitch: MidiPitch): string {
  const n = pitch as number;
  const octave = Math.floor(n / 12) - 1;
  const name = PITCH_CLASS_NAME[((n % 12) + 12) % 12]!;
  return `${name}${octave}`;
}
