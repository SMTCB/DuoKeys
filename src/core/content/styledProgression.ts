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

  const chordIndexAt = assignChords(
    file.notes.map((n) => ({ start: n.startTick as number, pitch: (n.pitch as number) + offset })),
    chordEntries.map((c) => new Set(c!.midiNotes.map((m) => (m as number) % 12))),
    (start) => Math.min(chordCount - 1, Math.floor(((start + ANTICIPATION_BEATS * beatTicks) * chordCount) / loopTicks)),
  );

  const loopNotes: { pitch: number; start: number; duration: number; chordIndex: number }[] = file.notes.map((n) => ({
    pitch: (n.pitch as number) + offset,
    start: n.startTick as number,
    duration: n.durationTicks as number,
    chordIndex: chordIndexAt.get(n.startTick as number) ?? 0,
  }));

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

/**
 * Which chord of the progression each onset belongs to. The style files do not
 * change chord at evenly spaced moments (a three-chord loop may hold the first
 * chord for a beat and a half), so equal time slices put the wrong chord on the
 * screen. Instead the onsets, in time order, are walked through the chords in
 * order, choosing the change points that leave the fewest notes outside their
 * chord; the equal-slice guess only breaks ties. With fewer onsets than chords
 * it falls back to the slice guess.
 */
function assignChords(
  notes: readonly { start: number; pitch: number }[],
  chordPitchClasses: readonly ReadonlySet<number>[],
  sliceGuess: (start: number) => number,
): Map<number, number> {
  const starts = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);
  const chordCount = chordPitchClasses.length;
  const result = new Map<number, number>();
  if (starts.length < chordCount) {
    for (const start of starts) result.set(start, sliceGuess(start));
    return result;
  }

  const costOf = (start: number, chord: number): number => {
    let off = 0;
    for (const n of notes) if (n.start === start && !chordPitchClasses[chord]!.has(((n.pitch % 12) + 12) % 12)) off++;
    return off + 0.01 * Math.abs(chord - sliceGuess(start));
  };

  const best: number[][] = [];
  const from: number[][] = [];
  starts.forEach((start, g) => {
    best.push(new Array<number>(chordCount).fill(Infinity));
    from.push(new Array<number>(chordCount).fill(0));
    for (let c = 0; c < chordCount; c++) {
      if (g === 0) {
        if (c === 0) best[0]![0] = costOf(start, 0);
        continue;
      }
      const stay = best[g - 1]![c]!;
      const step = c > 0 ? best[g - 1]![c - 1]! : Infinity;
      const prev = step < stay ? c - 1 : c;
      best[g]![c] = Math.min(stay, step) + costOf(start, c);
      from[g]![c] = prev;
    }
  });

  let chord = chordCount - 1;
  for (let g = starts.length - 1; g >= 0; g--) {
    result.set(starts[g]!, chord);
    chord = from[g]![chord]!;
  }
  return result;
}
