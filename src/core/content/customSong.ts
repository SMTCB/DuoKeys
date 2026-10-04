// FR-STU-017 — a song the adult brings in: a pasted chord chart, a MIDI file or a
// MusicXML file. Pure: no I/O, no clock. Bytes and text come in, an Arrangement
// goes out; ids and timestamps are injected (ADR-005). The app never ships or
// fetches charts — the adult supplies the content (TA-CNT-005 is about what we
// bundle, not what a person types in for their own practice).

import { asTicks, PPQ } from '../time/types';
import type { Arrangement, Section } from './types';
import { chordEntryFromId, idOfChord, parseChordToken } from './chordSymbols';
import { asPitchClass, type ChordEntry, type ProgressionEntry } from './chordTypes';
import { progressionToArrangement } from './progressionArrangement';
import { parseSmf } from '../midi/smf';
import { smfToArrangement } from './songLibrary';
import { parseMusicXml } from './parseMusicXml';
import { buildArrangementFromSource } from './buildArrangement';

export const CUSTOM_SONG_PREFIX = 'custom:';
export const MAX_CUSTOM_BYTES = 400_000;
export const MAX_CHART_CHARS = 20_000;

export type CustomSongKind = 'chart' | 'midi' | 'musicxml';

export interface CustomSong {
  id: string; // "custom:<uuid>"
  title: string;
  artist: string;
  kind: CustomSongKind;
  /** chart text, MusicXML text, or base64 MIDI bytes */
  data: string;
  addedAtMs: number;
}

export const isCustomSongId = (id: string): boolean => id.startsWith(CUSTOM_SONG_PREFIX);

export interface ChartSection {
  label: string;
  /** index into `chordIds` where the section starts */
  startIndex: number;
}

export interface ParsedChart {
  chordIds: string[];
  sections: ChartSection[];
  /** chord-shaped tokens we could not read, e.g. "Cxyz" */
  unsupported: string[];
}

const SECTION_RE = /^\s*[[(]?\s*(intro|verse|chorus|pre-?chorus|bridge|outro|solo|interlude|refrain|riff|coda)\b[^\]\n)]*[\])]?\s*:?\s*$/i;
const CHORD_SHAPE = /^[A-G][#b♯♭]?[A-Za-z0-9+°ø#♯♭()-]*(\/[A-G][#b♯♭]?)?$/;
const NOISE = /^(x\d+|\d+x|%|n\.?c\.?|\||\/|-|—|\(?x\d+\)?)$/i;

function chordTokensOf(line: string): string[] | undefined {
  const tokens = line.split(/[\s|]+/).filter((t) => t.length > 0 && !NOISE.test(t));
  return tokens.length > 0 ? tokens : undefined;
}

/** Reads a pasted chart: chord lines become the harmony; section headers and lyrics are recognised and set aside. */
export function parseChordChart(text: string): ParsedChart {
  const chordIds: string[] = [];
  const sections: ChartSection[] = [];
  const unsupported: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (SECTION_RE.test(line)) {
      sections.push({ label: line.replace(/[[\]():]/g, '').trim(), startIndex: chordIds.length });
      continue;
    }
    const tokens = chordTokensOf(line);
    if (!tokens || !tokens.every((t) => CHORD_SHAPE.test(t))) continue;
    const results = tokens.map((t) => ({ t, r: parseChordToken(t, asPitchClass(0), 'major') }));
    const readable = results.filter((x) => x.r.ok).length;
    if (readable * 2 < tokens.length) continue; // "And Be" is a lyric, not a chord line
    for (const { t, r } of results) {
      if (r.ok) chordIds.push(idOfChord(r.chord));
      else unsupported.push(t);
    }
  }
  return { chordIds, sections, unsupported };
}

const BEATS_PER_CHORD = 4;

function entriesOf(chordIds: readonly string[]): ChordEntry[] {
  const seen = new Set<string>();
  const out: ChordEntry[] = [];
  for (const id of chordIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    const e = chordEntryFromId(id);
    if (e) out.push(e);
  }
  return out;
}

/** A chart as a playable Arrangement: one bar per chord, with the chart's own sections. Undefined when it has no chords. */
export function chartToArrangement(song: Pick<CustomSong, 'id' | 'title'>, chart: ParsedChart, bpm = 70): Arrangement | undefined {
  if (chart.chordIds.length === 0) return undefined;
  const progression: ProgressionEntry = {
    id: song.id,
    name: song.title,
    key: asPitchClass(0),
    mode: 'major',
    moods: [],
    chordIds: chart.chordIds,
    suggestedBpm: bpm,
  };
  const base = progressionToArrangement(progression, entriesOf(chart.chordIds), 1);
  const barTicks = BEATS_PER_CHORD * PPQ;
  const total = base.chordMarkers?.length ?? chart.chordIds.length;
  const sections: Section[] = chart.sections
    .map((s, i): Section => {
      const end = chart.sections[i + 1]?.startIndex ?? total;
      return {
        id: `s${i + 1}`,
        label: s.label,
        startTick: asTicks(s.startIndex * barTicks),
        endTick: asTicks(end * barTicks),
        barRange: [s.startIndex + 1, Math.max(end, s.startIndex + 1)],
        kind: 'quest',
      };
    })
    .filter((s) => (s.endTick as number) > (s.startTick as number));
  return {
    ...base,
    id: song.id,
    pieceId: song.id,
    keySig: song.title,
    tempoMap: [{ atTick: asTicks(0), bpm }],
    sections: sections.length > 0 ? sections : base.sections,
  };
}

export type CustomArrangementResult = { ok: true; arrangement: Arrangement } | { ok: false; error: string };

/** Builds the arrangement for a stored song. `midiBytes` is the decoded file for kind "midi". */
export function customSongToArrangement(song: CustomSong, midiBytes?: Uint8Array): CustomArrangementResult {
  try {
    if (song.kind === 'chart') {
      const made = chartToArrangement(song, parseChordChart(song.data));
      return made ? { ok: true, arrangement: made } : { ok: false, error: 'no chords found in this chart' };
    }
    if (song.kind === 'midi') {
      if (!midiBytes) return { ok: false, error: 'the MIDI file is missing' };
      const parsed = parseSmf(midiBytes);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const made = smfToArrangement(parsed.file, { id: song.id, title: song.title });
      return made ? { ok: true, arrangement: made } : { ok: false, error: 'that file has no notes' };
    }
    const source = parseMusicXml(song.data, { id: song.id });
    return { ok: true, arrangement: buildArrangementFromSource({ ...source, id: song.id, title: song.title }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Reads the list back off an opaque settings record; anything malformed is ignored. */
export function customSongsOf(settings: unknown): CustomSong[] {
  const raw = (settings as { customSongs?: unknown } | undefined)?.customSongs;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is CustomSong =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as CustomSong).id === 'string' &&
      typeof (s as CustomSong).title === 'string' &&
      typeof (s as CustomSong).data === 'string' &&
      ['chart', 'midi', 'musicxml'].includes((s as CustomSong).kind),
  );
}

/** Pure: validates and shapes a new song. `id` and `addedAtMs` are injected. */
export function makeCustomSong(input: {
  id: string;
  title: string;
  artist: string;
  kind: CustomSongKind;
  data: string;
  addedAtMs: number;
}): { ok: true; song: CustomSong } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Give the song a name' };
  if (input.kind === 'chart') {
    if (input.data.length > MAX_CHART_CHARS) return { ok: false, error: 'That chart is too long' };
    if (parseChordChart(input.data).chordIds.length === 0) {
      return { ok: false, error: 'No chords found. Paste the chord lines, like: C  G  Am  F' };
    }
  } else if (input.data.length > MAX_CUSTOM_BYTES * 1.4) {
    return { ok: false, error: 'That file is too big' };
  }
  return {
    ok: true,
    song: { id: `${CUSTOM_SONG_PREFIX}${input.id}`, title, artist: input.artist.trim(), kind: input.kind, data: input.data, addedAtMs: input.addedAtMs },
  };
}
