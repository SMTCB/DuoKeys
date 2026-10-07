// FR-STU-016 — the song library: pieces mirrored from Mutopia (public domain and
// Creative Commons) as .mid files, searched from a bundled index and played as
// falling notes. This file is the pure half: the index entry, search, and the
// conversion from a parsed Standard MIDI File to an Arrangement. Fetching the
// index and the bytes is the adapter's job (adapters/content/staticSongs.ts).

import { asMidiPitch } from '../midi/decode';
import type { SmfFile, SmfNote } from '../midi/smf';
import { asTicks, PPQ } from '../time/types';
import type { Arrangement, ContentNote, Track } from './types';

export interface SongEntry {
  /** `mutopia-<piece number>` — also the arrangement id. */
  id: string;
  title: string;
  /** "J. S. Bach (1685–1750)" as Mutopia prints it. */
  composer: string;
  opus: string;
  /** Romantic, Baroque, Folk… as Mutopia files it; '' when it does not. */
  style: string;
  /** 'Piano', 'Harpsichord', … */
  instrument: string;
  /** Key into content/licences.json. */
  licenceId: string;
  /** Human wording, e.g. "Public Domain" or "Creative Commons Attribution 4.0". */
  licenceLabel: string;
  licenceUrl: string;
  /** The piece's own page, for attribution. */
  sourceUrl: string;
  noteCount: number;
  bars: number;
  bpm: number;
}

export interface SongIndex {
  songs: SongEntry[];
}

/** Lower-case, accent-free, punctuation-free, so "Étude" is found by "etude". */
export function normaliseForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export type SongLevel = 1 | 2 | 3 | 4 | 5;

export const SONG_LEVEL_LABEL: Readonly<Record<SongLevel, string>> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'Expert',
};

// Upper bound of notes per bar for each level. The index carries no hand-scored difficulty, so
// this is an estimate of how busy the page is; the bands split the 576 library pieces about evenly.
const LEVEL_NOTES_PER_BAR: readonly number[] = [10, 13, 17, 22];

/** How hard a library piece probably is, from how many notes it packs into a bar. */
export function songLevel(song: Pick<SongEntry, 'noteCount' | 'bars'>): SongLevel {
  const notesPerBar = song.noteCount / Math.max(1, song.bars);
  const index = LEVEL_NOTES_PER_BAR.findIndex((limit) => notesPerBar <= limit);
  return (index === -1 ? 5 : index + 1) as SongLevel;
}

export interface SongFilter {
  text?: string;
  style?: string;
  /** Only pieces at this estimated level. */
  level?: SongLevel;
}

/** Every word typed must appear somewhere in title, composer, opus or style. Order is kept (the index is already sorted). */
export function searchSongs(songs: readonly SongEntry[], filter: SongFilter): SongEntry[] {
  const words = normaliseForSearch(filter.text ?? '').split(' ').filter(Boolean);
  return songs.filter((s) => {
    if (filter.style && s.style !== filter.style) return false;
    if (filter.level !== undefined && songLevel(s) !== filter.level) return false;
    if (words.length === 0) return true;
    const hay = normaliseForSearch(`${s.title} ${s.composer} ${s.opus} ${s.style}`);
    return words.every((w) => hay.includes(w));
  });
}

export function stylesOf(songs: readonly SongEntry[]): string[] {
  return [...new Set(songs.map((s) => s.style).filter((s) => s !== ''))].sort();
}

/** The middle C split used when a file does not already separate the hands. */
const HAND_SPLIT_PITCH = 60;

function toContentNote(n: SmfNote, id: string, groupId: string, trackId: string, scale: number): ContentNote {
  return {
    id,
    pitch: asMidiPitch(n.pitch as number),
    startTick: asTicks(Math.round((n.startTick as number) * scale)),
    durationTicks: asTicks(Math.max(1, Math.round((n.durationTicks as number) * scale))),
    groupId,
    trackId,
  };
}

/** Which hand each file track is: two note tracks are read as right then left (Mutopia's order); anything else splits at middle C. */
function handOf(file: SmfFile): (n: SmfNote) => 'R' | 'L' {
  const trackIndexes = [...new Set(file.notes.map((n) => n.trackIndex))].sort((a, b) => a - b);
  if (trackIndexes.length === 2) {
    const right = trackIndexes[0]!;
    return (n) => (n.trackIndex === right ? 'R' : 'L');
  }
  return (n) => ((n.pitch as number) >= HAND_SPLIT_PITCH ? 'R' : 'L');
}

/**
 * A whole piece as an Arrangement with tracks `both` (what you play with two hands),
 * `rh` and `lh`. Notes that begin together share a group, so a chord or a pair of
 * hands is one decision in wait mode. Returns undefined for a file with no notes.
 */
export function smfToArrangement(file: SmfFile, song: Pick<SongEntry, 'id' | 'title'>): Arrangement | undefined {
  if (file.notes.length === 0) return undefined;
  const scale = PPQ / file.ticksPerQuarter;
  const hand = handOf(file);

  const both: ContentNote[] = [];
  const rh: ContentNote[] = [];
  const lh: ContentNote[] = [];
  file.notes.forEach((n, i) => {
    const groupId = `t${n.startTick as number}`;
    both.push(toContentNote(n, `n${i}`, groupId, 'both', scale));
    if (hand(n) === 'R') rh.push(toContentNote(n, `r${i}`, groupId, 'rh', scale));
    else lh.push(toContentNote(n, `l${i}`, groupId, 'lh', scale));
  });

  const tracks: Track[] = [{ id: 'both', role: 'melody', notes: both }];
  if (rh.length > 0 && lh.length > 0) {
    tracks.push({ id: 'rh', role: 'rh', hand: 'R', notes: rh }, { id: 'lh', role: 'lh', hand: 'L', notes: lh });
  }

  const tempoMap: { atTick: ReturnType<typeof asTicks>; bpm: number }[] = [];
  for (const t of file.tempoChanges) {
    const bpm = Math.round(60_000_000 / t.microsecondsPerQuarter);
    if (tempoMap.length === 0 || tempoMap[tempoMap.length - 1]!.bpm !== bpm) {
      tempoMap.push({ atTick: asTicks(Math.round((t.tick as number) * scale)), bpm });
    }
  }

  const { numerator, denominator } = file.timeSignature;
  const barTicks = (PPQ * 4 * numerator) / denominator;
  const endTick = asTicks(Math.round((file.totalTicks as number) * scale));
  const totalBars = Math.max(1, Math.ceil((endTick as number) / barTicks));
  return {
    id: song.id,
    pieceId: song.id,
    difficulty: 3,
    tempoMap,
    timeSig: [numerator, denominator],
    keySig: '',
    tracks,
    sections: [{ id: 'all', label: song.title, startTick: asTicks(0), endTick, barRange: [1, totalBars], kind: 'quest' }],
    analysis: { pitchRange: 0, handPositionChanges: 0, rhythmicVocabulary: 0, handIndependence: 0, accidentalDensity: 0, overall: 3 },
  };
}

/** True when no two notes of the track begin together — the only shape the notation view can draw. */
export function isMonophonic(track: Track): boolean {
  const seen = new Set<string>();
  for (const n of track.notes) {
    if (seen.has(n.groupId)) return false;
    seen.add(n.groupId);
  }
  return true;
}
