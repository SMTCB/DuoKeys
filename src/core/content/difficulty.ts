// TA-CNT-002 — five-axis difficulty scoring. Each field on `DifficultyBreakdown`
// (other than `overall`) is a raw, inspectable signal — semitone span, a raw
// jump count, a raw distinct-duration count, or a 0–1 fraction — published
// so a mis-scored piece can be diagnosed rather than hand-overridden.
// `overall` bands each raw signal 1–5 against the thresholds below and
// averages them with equal weight: this slice's initial weighting, not yet
// tuned against real content.

import type { ContentNote, DifficultyBreakdown, Track } from './types';

const MIDDLE_C = 60;
const FIVE_FINGER_SPAN = 7; // semitones spanned by fingers 1-5 in a diatonic position, e.g. C4..G4

// Pitch classes (0-11) diatonic to a key, for accidental-density scoring.
// Extend as later content authors in more keys. Exported so generators
// (content/sightReading.ts) can constrain pitch choices to the same table
// difficulty scoring judges them against, instead of a second copy drifting.
export const DIATONIC_PITCH_CLASSES: Record<string, number[]> = {
  C: [0, 2, 4, 5, 7, 9, 11],
  G: [7, 9, 11, 0, 2, 4, 6],
  F: [5, 7, 9, 10, 0, 2, 4],
};

function band(value: number, thresholds: readonly number[]): 1 | 2 | 3 | 4 | 5 {
  const index = thresholds.findIndex((t) => value <= t);
  return (index === -1 ? 5 : index + 1) as 1 | 2 | 3 | 4 | 5;
}

export function scoreDifficulty(tracks: readonly Track[], keySig: string): DifficultyBreakdown {
  const allNotes: ContentNote[] = tracks.flatMap((t) => t.notes);
  const pitches = allNotes.map((n) => n.pitch as number);

  const pitchSpan = pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0;
  const distanceFromMiddleC = pitches.length ? Math.max(...pitches.map((p) => Math.abs(p - MIDDLE_C))) : 0;
  const pitchRange = Math.max(pitchSpan, distanceFromMiddleC);

  let handPositionChanges = 0;
  for (const track of tracks) {
    const sorted = [...track.notes].sort((a, b) => (a.startTick as number) - (b.startTick as number));
    for (let i = 1; i < sorted.length; i++) {
      const jump = Math.abs((sorted[i]!.pitch as number) - (sorted[i - 1]!.pitch as number));
      if (jump > FIVE_FINGER_SPAN) handPositionChanges++;
    }
  }

  const rhythmicVocabulary = new Set(allNotes.map((n) => n.durationTicks as number)).size;

  // Multi-track hand-independence scoring is deferred until two-track
  // content is authored (TA-CNT-002) — every piece this slice is one track.
  const handIndependence = 0;

  const scale = DIATONIC_PITCH_CLASSES[keySig];
  const accidentalDensity =
    scale && allNotes.length
      ? allNotes.filter((n) => !scale.includes((((n.pitch as number) % 12) + 12) % 12)).length / allNotes.length
      : 0;

  const overall = Math.min(
    5,
    Math.max(
      1,
      Math.round(
        (band(pitchRange, [7, 9, 12, 19]) +
          band(handPositionChanges, [0, 2, 4, 7]) +
          band(rhythmicVocabulary, [2, 3, 4, 5]) +
          band(handIndependence, [0, 0.25, 0.5, 0.75]) +
          band(accidentalDensity, [0, 0.05, 0.15, 0.3])) /
          5,
      ),
    ),
  ) as 1 | 2 | 3 | 4 | 5;

  return { pitchRange, handPositionChanges, rhythmicVocabulary, handIndependence, accidentalDensity, overall };
}
