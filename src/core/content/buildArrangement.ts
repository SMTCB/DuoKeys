// TA-CNT-001 stages 3-6 (normalise, group, segment, analyse) — the pure
// transform from a hand-authored source tune to a playable Arrangement.
// content/build/ingest.ts is the only caller in production (it adds file
// I/O, validation, and the licence gate around this); tests call it directly
// against fixture sources so the pipeline logic itself has no I/O to fake.

import { noteNameToMidiPitch } from './noteName';
import { segmentFallback } from './segmentSections';
import { scoreDifficulty } from './difficulty';
import { groupNotesByTicks } from '../match/types';
import { asTicks, type Ticks } from '../time/types';
import type { Arrangement, ChordMarker, ContentNote, Track, TrackRole } from './types';

export interface SourceNoteInput {
  /** Omit only when `rest` is true. */
  pitch?: string;
  durationTicks: number;
  /** A silence: advances the track's cursor but emits no note. */
  rest?: boolean;
  /** Shares the previous (non-rest) note's start tick instead of advancing the cursor — a simultaneous onset. */
  chord?: boolean;
}

export interface SourceTrackInput {
  id: string;
  role: TrackRole;
  hand?: 'L' | 'R';
  notes: SourceNoteInput[];
}

export interface SourceInput {
  id: string;
  title: string;
  tempoBpm: number;
  timeSig: [number, number];
  keySig: string;
  tracks: SourceTrackInput[];
  /** TA-CNT-001 stage 5 fallback quest-section length, in bars. Default 2 (the documented fallback). */
  barsPerQuest?: number;
  /** FR-STU-013 — lead-sheet chord symbols; absent for content with no authored harmony. */
  chordMarkers?: { atTick: number; symbol: string }[];
}

function buildTrack(sourceTrack: SourceTrackInput): Track {
  let cursorTick = 0;
  const withTicks: { id: string; atTick: Ticks; pitch: ReturnType<typeof noteNameToMidiPitch>; durationTicks: number }[] = [];
  sourceTrack.notes.forEach((n, i) => {
    if (n.rest) {
      cursorTick += n.durationTicks;
      return;
    }
    if (n.pitch === undefined) throw new Error(`buildArrangementFromSource: note ${i} has no pitch and is not a rest`);
    const pitch = noteNameToMidiPitch(n.pitch);
    const atTick = asTicks(n.chord ? (withTicks[withTicks.length - 1]?.atTick ?? cursorTick) : cursorTick);
    withTicks.push({ id: `n${i + 1}`, atTick, pitch, durationTicks: n.durationTicks });
    if (!n.chord) cursorTick += n.durationTicks;
  });
  const grouped = groupNotesByTicks(withTicks, 30);
  const notes: ContentNote[] = grouped.map((n) => ({
    id: n.id,
    pitch: n.pitch,
    startTick: n.atTick,
    durationTicks: asTicks(n.durationTicks),
    groupId: n.groupId,
    trackId: sourceTrack.id,
  }));
  return {
    id: sourceTrack.id,
    role: sourceTrack.role,
    notes,
    ...(sourceTrack.hand !== undefined ? { hand: sourceTrack.hand } : {}),
  };
}

export function buildArrangementFromSource(source: SourceInput): Arrangement {
  const tracks = source.tracks.map(buildTrack);
  // Max over every note's end, not just the last one in tick order: a chord
  // note shares its base note's start tick but can carry a shorter duration,
  // so the note that starts last isn't guaranteed to end last.
  const totalTicks: Ticks = tracks.reduce((max, t) => {
    const trackEnd = t.notes.reduce((m, n) => Math.max(m, (n.startTick as number) + (n.durationTicks as number)), 0);
    return asTicks(Math.max(max as number, trackEnd));
  }, asTicks(0));

  const analysis = scoreDifficulty(tracks, source.keySig);
  const sections = segmentFallback(totalTicks, source.timeSig, source.title, source.barsPerQuest ?? 2);
  const chordMarkers: ChordMarker[] | undefined = source.chordMarkers?.map((m) => ({
    atTick: asTicks(m.atTick),
    symbol: m.symbol,
  }));

  return {
    id: `${source.id}-d${analysis.overall}`,
    pieceId: source.id,
    difficulty: analysis.overall,
    tempoMap: [{ atTick: asTicks(0), bpm: source.tempoBpm }],
    timeSig: source.timeSig,
    keySig: source.keySig,
    tracks,
    sections,
    analysis,
    ...(chordMarkers ? { chordMarkers } : {}),
  };
}
