// TA-CNT-004 — generated sight-reading (FR-STU-010, US-3.10): "pick a key, a
// range, a rhythmic vocabulary and a difficulty, emit an eight-bar phrase
// never seen before." Unlike hanon.ts's fixed drill, this genuinely needs
// randomness, injected as `random: () => number` — the same convention
// core/session/arc.ts already uses (ADR-005: no Math.random() in core/, so
// the same fixed source makes a fixture reproducible, TS-U-CNT). Reuses
// buildArrangementFromSource so the rest of the pipeline (matcher, notation
// view, difficulty scoring) needs no changes.

import { PPQ } from '../time/types';
import { asMidiPitch } from '../midi/decode';
import { midiPitchToNoteName } from './noteName';
import { DIATONIC_PITCH_CLASSES } from './difficulty';
import { buildArrangementFromSource, type SourceInput, type SourceNoteInput } from './buildArrangement';
import type { Arrangement } from './types';

export interface SightReadingOptions {
  /** Caller-supplied id — core/ never sources one from Date.now() (ADR-005); default is fine when the caller doesn't need a unique one. */
  id?: string;
  keySig?: string;
  rangeLowMidi?: number;
  rangeHighMidi?: number;
  /** Note durations (ticks) the melody draws from — the "rhythmic vocabulary" FR-STU-010 asks for. */
  rhythmicVocabularyTicks?: readonly number[];
  bars?: number;
  beatsPerBar?: number;
  tempoBpm?: number;
}

const DEFAULT_OPTIONS: Required<SightReadingOptions> = {
  id: 'sight-reading',
  keySig: 'C',
  rangeLowMidi: 60, // C4
  rangeHighMidi: 72, // C5
  rhythmicVocabularyTicks: [PPQ, PPQ / 2], // quarter and eighth notes
  bars: 8,
  beatsPerBar: 4,
  tempoBpm: 90,
};

// Stepwise motion keeps a generated phrase actually readable at sight,
// rather than difficulty.ts's hand-position-change axis flagging every bar
// as a leap: each note stays within this many scale steps of the last.
const STEP_RADIUS = 2;

function pitchesInRange(scalePitchClasses: readonly number[], low: number, high: number): number[] {
  const result: number[] = [];
  for (let p = low; p <= high; p++) {
    if (scalePitchClasses.includes(((p % 12) + 12) % 12)) result.push(p);
  }
  return result;
}

function pickDuration(vocabulary: readonly number[], remainingTicks: number, random: () => number): number {
  const fitting = vocabulary.filter((d) => d <= remainingTicks);
  if (fitting.length === 0) return remainingTicks;
  return fitting[Math.floor(random() * fitting.length)]!;
}

function pickNextPitch(candidates: readonly number[], previousPitch: number | undefined, random: () => number): number {
  if (previousPitch === undefined) return candidates[Math.floor(random() * candidates.length)]!;
  const previousIndex = candidates.indexOf(previousPitch);
  const low = Math.max(0, previousIndex - STEP_RADIUS);
  const high = Math.min(candidates.length - 1, previousIndex + STEP_RADIUS);
  return candidates[low + Math.floor(random() * (high - low + 1))]!;
}

/**
 * TS-U-CNT (sight-reading): fills `bars` of `beatsPerBar`/4 time with notes
 * drawn from `rhythmicVocabularyTicks`, pitches confined to `keySig`'s
 * diatonic scale within [rangeLowMidi, rangeHighMidi] and moving stepwise.
 * Deterministic under a fixed `random` source (TS-U-CNT: two calls with the
 * same source and options produce an identical Arrangement).
 */
export function generateSightReadingArrangement(
  random: () => number,
  options: SightReadingOptions = {},
): Arrangement {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const scale = DIATONIC_PITCH_CLASSES[opts.keySig] ?? DIATONIC_PITCH_CLASSES.C!;
  const candidates = pitchesInRange(scale, opts.rangeLowMidi, opts.rangeHighMidi);
  const totalTicks = opts.bars * opts.beatsPerBar * PPQ;

  const notes: SourceNoteInput[] = [];
  let remainingTicks = totalTicks;
  let previousPitch: number | undefined;
  while (remainingTicks > 0) {
    const duration = pickDuration(opts.rhythmicVocabularyTicks, remainingTicks, random);
    const pitch = pickNextPitch(candidates, previousPitch, random);
    notes.push({ pitch: midiPitchToNoteName(asMidiPitch(pitch)), durationTicks: duration });
    previousPitch = pitch;
    remainingTicks -= duration;
  }

  const source: SourceInput = {
    id: opts.id,
    title: 'Sight-Reading',
    tempoBpm: opts.tempoBpm,
    timeSig: [opts.beatsPerBar, 4],
    keySig: opts.keySig,
    tracks: [{ id: 'melody', role: 'melody', notes }],
  };
  return buildArrangementFromSource(source);
}
