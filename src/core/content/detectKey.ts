// FR-STU-016 / TA-REN-003 — which key a piece is in, worked out from its notes. MIDI files and
// most scanned scores carry no usable key, so this listens to the notes instead: the
// Krumhansl–Schmuckler method compares how long each of the twelve pitch classes sounds
// with the profile of a major and a minor key and picks the closest match.

import type { Arrangement } from './types';

const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Major keys written with flats; minor keys are looked up through their relative major. */
const FLAT_MAJOR_TONICS = new Set([5, 10, 3, 8, 1]);

export interface DetectedKey {
  /** 0 = C … 11 = B */
  tonicPitchClass: number;
  mode: 'major' | 'minor';
  /** e.g. "G major", "Eb minor" */
  name: string;
  /** True when sharps are the better spelling for this key. */
  isSharpKey: boolean;
}

function correlation(a: readonly number[], b: readonly number[]): number {
  const meanA = a.reduce((s, x) => s + x, 0) / a.length;
  const meanB = b.reduce((s, x) => s + x, 0) / b.length;
  let num = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    num += da * db;
    sa += da * da;
    sb += db * db;
  }
  return sa === 0 || sb === 0 ? 0 : num / Math.sqrt(sa * sb);
}

export function keyName(tonicPitchClass: number, mode: 'major' | 'minor'): string {
  const pc = ((tonicPitchClass % 12) + 12) % 12;
  const relativeMajor = mode === 'major' ? pc : (pc + 3) % 12;
  const names = FLAT_MAJOR_TONICS.has(relativeMajor) ? FLAT_NAMES : SHARP_NAMES;
  return `${names[pc]} ${mode}`;
}

/** Whether a piece in this key is better written with sharps (true) or flats (false). */
export function prefersSharps(tonicPitchClass: number, mode: 'major' | 'minor'): boolean {
  const pc = ((tonicPitchClass % 12) + 12) % 12;
  return !FLAT_MAJOR_TONICS.has(mode === 'major' ? pc : (pc + 3) % 12);
}

/** The most likely key of the notes, or undefined when there are too few to say. */
export function detectKey(arrangement: Arrangement): DetectedKey | undefined {
  const weights = new Array<number>(12).fill(0);
  let count = 0;
  for (const track of arrangement.tracks) {
    for (const note of track.notes) {
      const pc = (note.pitch as number) % 12;
      weights[pc] = (weights[pc] ?? 0) + Math.max(1, note.durationTicks as number);
      count += 1;
    }
  }
  if (count < 4) return undefined;
  let best: { pc: number; mode: 'major' | 'minor'; score: number } | undefined;
  for (let pc = 0; pc < 12; pc += 1) {
    for (const mode of ['major', 'minor'] as const) {
      const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE;
      const rotated = profile.map((_, i) => profile[(i - pc + 12) % 12] ?? 0);
      const score = correlation(weights, rotated);
      if (!best || score > best.score) best = { pc, mode, score };
    }
  }
  if (!best) return undefined;
  return {
    tonicPitchClass: best.pc,
    mode: best.mode,
    name: keyName(best.pc, best.mode),
    isSharpKey: prefersSharps(best.pc, best.mode),
  };
}
