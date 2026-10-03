// FR-STU-015 — a chord progression played in a rhythmic style, read from the
// bundled free-midi-chords style files (pop, pop2, soul, hiphop2; MIT).
//
// The files exist for one reference key per set (C for Major and Modal, A for
// Minor). Playing another key shifts every pitch by the key distance, folded to
// -6..+5 so the voicing stays where it was written. The Arrangement is the same
// shape progressionToArrangement produces, so the same wait-mode session and
// falling-notes view play it unchanged.

import { asMidiPitch } from '../midi/decode';
import type { SmfFile } from '../midi/smf';
import { asTicks, PPQ } from '../time/types';
import type { Arrangement, ChordMarker, ContentNote } from './types';
import type { ChordEntry, ProgressionEntry } from './chordTypes';
import { chordSymbolOfId } from './chordSymbols';
import { progressionArrangementId } from './progressionArrangement';

export const CHORD_STYLES = [
  { id: 'pop', label: 'Pop' },
  { id: 'pop2', label: 'Pop 2' },
  { id: 'soul', label: 'Soul' },
  { id: 'hiphop2', label: 'Hip-hop' },
] as const;
export type ChordStyleId = (typeof CHORD_STYLES)[number]['id'];

/** The key each set's style files are written in, as a pitch class. */
const REFERENCE_KEY = { major: 0, modal: 0, minor: 9 } as const;

/** A chord change may be played a half beat early (an anticipation); this much is forgiven when finding where it belongs. */
const ANTICIPATION_BEATS = 0.5;

export function styleKeyOffset(progression: ProgressionEntry): number {
  const raw = (((progression.key as number) - REFERENCE_KEY[progression.mode]) % 12 + 12) % 12;
  return raw >= 6 ? raw - 12 : raw;
}

/** Path under /content/chords/styles/ — undefined for a progression the release has no style files for (the blues). */
export function styleFilePath(style: ChordStyleId, progression: ProgressionEntry): string | undefined {
  if (progression.name.startsWith('12-bar-blues')) return undefined;
  const repeat = progression.id.endsWith('~2') ? '~2' : '';
  return `${style}/${progression.mode}/${progression.name}${repeat}.mid`;
}

/** Builds the styled arrangement; `chords` must contain every id in the progression. Returns undefined if a chord is missing. */
export function styledProgressionToArrangement(
  progression: ProgressionEntry,
  chords: readonly ChordEntry[],
  file: SmfFile,
  repeats = 2,
): Arrangement | undefined {
  const byId = new Map(chords.map((c) => [c.id, c]));
  const chordEntries = progression.chordIds.map((id) => byId.get(id));
  if (chordEntries.some((c) => c === undefined) || file.notes.length === 0) return undefined;

  const offset = styleKeyOffset(progression);
  const scale = PPQ / file.ticksPerQuarter;
  const beatTicks = file.ticksPerQuarter;
  const beatsPerBar = (file.timeSignature.numerator * 4) / file.timeSignature.denominator;
  const barTicks = beatTicks * beatsPerBar;
  const loopTicks = Math.max(barTicks, Math.ceil((file.totalTicks as number) / barTicks) * barTicks);
  const chordCount = chordEntries.length;

  const loopNotes: { pitch: number; start: number; duration: number; chordIndex: number }[] = file.notes.map((n) => {
    const shifted = (n.startTick as number) + ANTICIPATION_BEATS * beatTicks;
    return {
      pitch: (n.pitch as number) + offset,
      start: n.startTick as number,
      duration: n.durationTicks as number,
      chordIndex: Math.min(chordCount - 1, Math.floor((shifted * chordCount) / loopTicks)),
    };
  });

  const markers: ChordMarker[] = [];
  const notes: ContentNote[] = [];
  const firstStartOfChord = new Map<number, number>();
  for (const n of loopNotes) {
    const known = firstStartOfChord.get(n.chordIndex);
    if (known === undefined || n.start < known) firstStartOfChord.set(n.chordIndex, n.start);
  }

  for (let pass = 0; pass < repeats; pass++) {
    const passStart = pass * loopTicks;
    for (let i = 0; i < chordCount; i++) {
      const start = firstStartOfChord.get(i);
      if (start !== undefined) {
        markers.push({ atTick: asTicks(Math.round((passStart + start) * scale)), symbol: chordSymbolOfId(progression.chordIds[i]!) });
      }
    }
    loopNotes.forEach((n, i) => {
      const startTick = asTicks(Math.round((passStart + n.start) * scale));
      notes.push({
        id: `p${pass}-n${i}`,
        pitch: asMidiPitch(n.pitch),
        startTick,
        durationTicks: asTicks(Math.max(1, Math.round(n.duration * scale))),
        groupId: `p${pass}-t${n.start}`,
        trackId: 'chords',
      });
    });
  }

  const microsecondsPerQuarter = file.tempoChanges[0]?.microsecondsPerQuarter ?? 750_000;
  const bpm = Math.round(60_000_000 / microsecondsPerQuarter);
  const endTick = asTicks(Math.round(repeats * loopTicks * scale));
  const totalBars = Math.max(1, Math.round((repeats * loopTicks) / barTicks));
  return {
    id: progressionArrangementId(progression.id),
    pieceId: progression.id,
    difficulty: 1,
    tempoMap: [{ atTick: asTicks(0), bpm }],
    timeSig: [file.timeSignature.numerator, file.timeSignature.denominator],
    keySig: progression.name,
    tracks: [{ id: 'chords', role: 'melody', notes }],
    sections: [{ id: 'all', label: progression.name, startTick: asTicks(0), endTick, barRange: [1, totalBars], kind: 'quest' }],
    analysis: { pitchRange: 0, handPositionChanges: 0, rhythmicVocabulary: 0, handIndependence: 0, accidentalDensity: 0, overall: 1 },
    chordMarkers: markers,
  };
}
