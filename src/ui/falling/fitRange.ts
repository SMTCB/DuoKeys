// TA-REN-002 — the span of keys the falling-notes lanes cover. Fitting it to the
// notes being played (instead of all 88 keys) is what makes a two-octave chord
// progression fill the screen instead of sitting in a sliver at one edge.

import type { MidiPitch } from '../../core/midi/decode';
import type { KeyboardRange } from './pitchToX';

const WHITE_PITCH_CLASS = new Set([0, 2, 4, 5, 7, 9, 11]);
const PADDING_SEMITONES = 2;
const MIN_SPAN_SEMITONES = 24;

function isWhite(pitch: number): boolean {
  return WHITE_PITCH_CLASS.has(((pitch % 12) + 12) % 12);
}

/** Smallest white-key-aligned range holding every pitch (padded, at least two octaves), never wider than `limit`. */
export function fitKeyboardRange(pitches: readonly number[], limit: KeyboardRange): KeyboardRange {
  if (pitches.length === 0) return limit;
  const floor = limit.low as number;
  const ceiling = limit.high as number;
  let low = Math.min(...pitches) - PADDING_SEMITONES;
  let high = Math.max(...pitches) + PADDING_SEMITONES;
  const shortBy = MIN_SPAN_SEMITONES - (high - low);
  if (shortBy > 0) {
    low -= Math.floor(shortBy / 2);
    high += Math.ceil(shortBy / 2);
  }
  low = Math.max(floor, low);
  high = Math.min(ceiling, high);
  while (low > floor && !isWhite(low)) low--;
  while (high < ceiling && !isWhite(high)) high++;
  return { low: low as MidiPitch, high: high as MidiPitch };
}
