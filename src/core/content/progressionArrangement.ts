// FR-STU-015 — a chord progression as an Arrangement, so the existing
// falling-notes view (TA-REN-001) and wait-mode matcher play it unchanged.
// One bar per chord, repeated; each chord's notes share a groupId, which is
// how WaitMatcher already treats a chord. No new renderer.

import { asTicks, PPQ } from '../time/types';
import type { Arrangement, ChordMarker, ContentNote } from './types';
import type { ChordEntry, ProgressionEntry } from './chordTypes';
import { chordSymbolOfId } from './chordSymbols';

export const PROGRESSION_ARRANGEMENT_PREFIX = 'chords:';
const BEATS_PER_CHORD = 4;
const SOUNDING_BEATS = 3; // a beat of air before the next chord, so repeated chords read as separate

export function progressionArrangementId(progressionId: string): string {
  return `${PROGRESSION_ARRANGEMENT_PREFIX}${progressionId}`;
}

/** Builds the arrangement; `chords` must contain every id in the progression, a missing one is skipped. */
export function progressionToArrangement(
  progression: ProgressionEntry,
  chords: readonly ChordEntry[],
  repeats = 4,
): Arrangement {
  const byId = new Map(chords.map((c) => [c.id, c]));
  const barTicks = BEATS_PER_CHORD * PPQ;
  const notes: ContentNote[] = [];
  const markers: ChordMarker[] = [];
  let bar = 0;
  for (let pass = 0; pass < repeats; pass++) {
    for (const chordId of progression.chordIds) {
      const chord = byId.get(chordId);
      if (!chord) continue;
      const startTick = asTicks(bar * barTicks);
      markers.push({ atTick: startTick, symbol: chordSymbolOfId(chordId) });
      chord.midiNotes.forEach((pitch, i) => {
        notes.push({
          id: `b${bar}-n${i}`,
          pitch,
          startTick,
          durationTicks: asTicks(SOUNDING_BEATS * PPQ),
          groupId: `b${bar}`,
          trackId: 'chords',
        });
      });
      bar++;
    }
  }
  const endTick = asTicks(bar * barTicks);
  return {
    id: progressionArrangementId(progression.id),
    pieceId: progression.id,
    difficulty: 1,
    tempoMap: [{ atTick: asTicks(0), bpm: 60 }],
    timeSig: [4, 4],
    keySig: progression.name,
    tracks: [{ id: 'chords', role: 'melody', notes }],
    sections: [
      { id: 'all', label: progression.name, startTick: asTicks(0), endTick, barRange: [1, Math.max(bar, 1)], kind: 'quest' },
    ],
    analysis: { pitchRange: 0, handPositionChanges: 0, rhythmicVocabulary: 0, handIndependence: 0, accidentalDensity: 0, overall: 1 },
    chordMarkers: markers,
  };
}
