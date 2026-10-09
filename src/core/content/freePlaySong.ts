// FR-STU-020 — "make me a song": a few minutes of music from the chord catalogue, written
// out for two hands. Pure; the seed is injected (ADR-005), so the same request always
// writes the same song and "play it again" needs nothing but the seed.
//
// A song is a form, not a longer loop: an intro, verses and choruses on two different
// progressions in one key, a bridge on a third, and an ending on the home chord. The left
// hand plays a bass pattern that gets busier from verse to chorus; the right hand plays a
// melody built from short repeated motifs (chord notes on the strong beats, scale steps
// between them), and a section that comes back brings its own melody back with it, which
// is what makes it sound written rather than random. Every bar also carries the notes that
// fit over its chord, for the "make up my own right hand" light-up.

import { asMidiPitch } from '../midi/decode';
import { asTicks, PPQ, type Ticks } from '../time/types';
import type { Arrangement, ChordMarker, ContentNote, Section, Track } from './types';
import type { ChordEntry, ChordIndex, PitchClass, ProgressionEntry } from './chordTypes';
import { chordSymbolOfId } from './chordSymbols';
import { chordId } from './chordCatalogue';
import { isEasyProgression } from './freePlay';

export const FREE_PLAY_SONG_PREFIX = 'song:';

export type SongLength = 'short' | 'song' | 'long';
/** 1: long notes and a plain bass; 2: a busier bass and more eighth notes in the tune. */
export type SongLevel = 1 | 2;
export type SongPartKind = 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';

export interface SongRequest {
  mood?: string;
  key?: PitchClass;
  length: SongLength;
  level: SongLevel;
  seed: number;
}

/** One bar's harmony: the chord's notes, and every note that sounds good over it (chord notes plus a pentatonic that does not rub). */
export interface HarmonyWindow {
  startTick: Ticks;
  endTick: Ticks;
  chordPitchClasses: readonly number[];
  fitPitchClasses: readonly number[];
}

export interface SongPart {
  kind: SongPartKind;
  label: string;
  progressionId: string;
  startTick: Ticks;
  endTick: Ticks;
}

export interface FreePlaySong {
  title: string;
  key: PitchClass;
  mode: ProgressionEntry['mode'];
  moods: readonly string[];
  bpm: number;
  parts: readonly SongPart[];
  arrangement: Arrangement;
  harmony: readonly HarmonyWindow[];
  /** Where the right hand plays, so the light-up covers the same keys. */
  rightHandRange: { low: number; high: number };
}

const EIGHTH = PPQ / 2;
const BAR = PPQ * 4;
const NOTE_GAP_TICKS = 40; // a breath between notes, so a repeated key reads as two
const LH_ROOT_LOW = 36; // C2: the bass root sits in C2..B2, so its octave stays below middle C
const RIGHT_HAND = { low: 60, high: 79 } as const;
const OUTRO_SLOWDOWN = 0.85;

const SCALE: Record<ProgressionEntry['mode'], readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  modal: [0, 2, 4, 5, 7, 9, 11], // modal progressions number their degrees off the major scale
  minor: [0, 2, 3, 5, 7, 8, 10],
};
const PENTATONIC: Record<ProgressionEntry['mode'], readonly number[]> = {
  major: [0, 2, 4, 7, 9],
  modal: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
};

const MELODY_REGISTER: Record<'verse' | 'chorus' | 'bridge', { low: number; high: number; centre: number }> = {
  verse: { low: 60, high: 74, centre: 67 },
  chorus: { low: 64, high: 79, centre: 72 },
  bridge: { low: 62, high: 76, centre: 69 },
};

/** A bar of the tune's rhythm, in eighths; a negative length is a rest. Each sums to a bar. */
const MOTIF_RHYTHMS: Record<SongLevel, readonly (readonly number[])[]> = {
  1: [[4, 4], [2, 2, 4], [4, 2, 2], [2, 2, 2, 2], [6, 2], [2, 4, 2], [-2, 2, 4], [-4, 2, 2]],
  2: [[2, 1, 1, 4], [1, 1, 2, 2, 2], [2, 2, 1, 1, 2], [3, 1, 2, 2], [3, 3, 2], [2, 1, 1, 2, 2], [-2, 1, 1, 2, 2], [-1, 1, 2, 4]],
};
const CADENCE_RHYTHMS: Record<SongLevel, readonly (readonly number[])[]> = {
  1: [[4, 4], [8], [2, 6]],
  2: [[4, 4], [2, 6], [1, 1, 6], [3, 5]],
};

type Voice = 'R' | '5' | '8';
/** [offset in eighths, length in eighths, the notes of the chord to play]. */
type PatternStep = readonly [number, number, readonly Voice[]];
const LH_PATTERNS: Record<string, readonly PatternStep[]> = {
  hold: [[0, 8, ['R', '5']]],
  halves: [[0, 4, ['R']], [4, 4, ['5']]],
  pulse: [[0, 4, ['R', '5']], [4, 4, ['R', '5']]],
  walk: [[0, 2, ['R']], [2, 2, ['5']], [4, 2, ['8']], [6, 2, ['5']]],
  roll: [[0, 1, ['R']], [1, 1, ['5']], [2, 1, ['8']], [3, 1, ['5']], [4, 1, ['R']], [5, 1, ['5']], [6, 1, ['8']], [7, 1, ['5']]],
  lilt: [[0, 3, ['R', '5']], [3, 3, ['R', '5']], [6, 2, ['R', '5']]],
};
const LH_BY_LEVEL: Record<SongLevel, Record<'verse' | 'chorus' | 'bridge', keyof typeof LH_PATTERNS>> = {
  1: { verse: 'halves', chorus: 'walk', bridge: 'pulse' },
  2: { verse: 'walk', chorus: 'roll', bridge: 'lilt' },
};

const SLOW_MOODS = new Set(['Sad', 'Tender', 'Peaceful', 'Nostalgic', 'Lonely', 'Spiritual', 'Dark', 'Romantic']);
const QUICK_MOODS = new Set(['Joyful', 'Excited', 'Triumphant', 'Playful', 'Empowered', 'Rebellious']);

const TITLE_WORDS: Record<string, readonly string[]> = {
  Hopeful: ['Morning', 'Open', 'Rising', 'First'],
  Romantic: ['Candle', 'Slow', 'Velvet', 'Moonlit'],
  Nostalgic: ['Old', 'Faded', 'Distant', 'Sunday'],
  Joyful: ['Bright', 'Sunny', 'Dancing', 'Summer'],
  Sad: ['Grey', 'Quiet', 'Rainy', 'Late'],
  Peaceful: ['Still', 'Gentle', 'Evening', 'Soft'],
  Mysterious: ['Hidden', 'Midnight', 'Secret', 'Misty'],
  Tender: ['Little', 'Gentle', 'Warm', 'Small'],
};
const DEFAULT_TITLE_WORDS = ['Wandering', 'Simple', 'Easy', 'Blue'];
const TITLE_NOUNS = ['Window', 'Road', 'Light', 'Harbour', 'Garden', 'Letter', 'River', 'Sky', 'Tide', 'Song', 'Kitchen', 'Lantern', 'Hill'];

/** A small seeded generator (mulberry32): the same seed always gives the same song. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

const pc = (n: number): number => ((n % 12) + 12) % 12;

/** How many bars each chord gets so a progression fills a 4- or 8-bar phrase; undefined for lengths that do not fit one. */
export function barsPerChord(chordCount: number): number[] | undefined {
  if (chordCount === 4 || chordCount === 8) return new Array<number>(chordCount).fill(1);
  if (chordCount === 3) return [1, 1, 2];
  if (chordCount === 2) return [2, 2];
  return undefined;
}

function isSongProgression(p: ProgressionEntry): boolean {
  return isEasyProgression(p) && !p.name.startsWith('12-bar-blues') && barsPerChord(p.chordIds.length) !== undefined;
}

/** The progressions a song can be built from: easy, and fitting a 4- or 8-bar phrase. */
export function songProgressions(progressions: readonly ProgressionEntry[]): ProgressionEntry[] {
  return progressions.filter(isSongProgression);
}

interface Bar {
  chord: ChordEntry;
  chordId: string;
}

interface PlannedPart {
  kind: SongPartKind;
  progression: ProgressionEntry;
  passes: number;
}

function choosePartners(
  pool: readonly ProgressionEntry[],
  verse: ProgressionEntry,
  random: () => number,
): { chorus: ProgressionEntry; bridge: ProgressionEntry } {
  const sameKey = pool.filter((p) => p.key === verse.key && p.mode === verse.mode && p.id !== verse.id);
  const sharesMood = (p: ProgressionEntry): boolean => p.moods.some((m) => verse.moods.includes(m));
  // A chorus that starts on a different chord from the verse is heard as somewhere new.
  const chorusPool = [
    sameKey.filter((p) => sharesMood(p) && p.chordIds[0] !== verse.chordIds[0]),
    sameKey.filter(sharesMood),
    sameKey,
  ].find((list) => list.length > 0);
  const chorus = (chorusPool && pick(chorusPool, random)) ?? verse;
  const tonicId = chordId(verse.key, verse.mode === 'minor' ? 'min' : 'maj');
  const others = sameKey.filter((p) => p.id !== chorus.id);
  // A bridge that does not start at home lifts the song before the last chorus.
  const bridgePool = [
    others.filter((p) => p.chordIds[0] !== tonicId && sharesMood(p)),
    others.filter((p) => p.chordIds[0] !== tonicId),
    others,
  ].find((list) => list.length > 0);
  const bridge = (bridgePool && pick(bridgePool, random)) ?? chorus;
  return { chorus, bridge };
}

function planForm(length: SongLength, verse: ProgressionEntry, chorus: ProgressionEntry, bridge: ProgressionEntry): PlannedPart[] {
  // Two passes of a four-bar progression make an eight-bar section; an eight-bar progression plays once.
  const passes = (p: ProgressionEntry): number => (p.chordIds.length === 8 ? 1 : 2);
  const v: PlannedPart = { kind: 'verse', progression: verse, passes: passes(verse) };
  const c: PlannedPart = { kind: 'chorus', progression: chorus, passes: passes(chorus) };
  const b: PlannedPart = { kind: 'bridge', progression: bridge, passes: passes(bridge) };
  const intro: PlannedPart = { kind: 'intro', progression: verse, passes: 1 };
  const outro: PlannedPart = { kind: 'outro', progression: verse, passes: 1 };
  if (length === 'short') return [intro, v, c, outro];
  if (length === 'song') return [intro, v, c, v, c, b, c, outro];
  return [intro, v, c, v, c, b, v, c, c, outro];
}

const PART_LABEL: Record<SongPartKind, string> = { intro: 'Intro', verse: 'Verse', chorus: 'Chorus', bridge: 'Bridge', outro: 'Ending' };

function barsOf(progression: ProgressionEntry, byId: ReadonlyMap<string, ChordEntry>): Bar[] | undefined {
  const lengths = barsPerChord(progression.chordIds.length);
  if (!lengths) return undefined;
  const bars: Bar[] = [];
  for (const [i, id] of progression.chordIds.entries()) {
    const chord = byId.get(id);
    if (!chord) return undefined;
    for (let b = 0; b < (lengths[i] ?? 1); b++) bars.push({ chord, chordId: id });
  }
  return bars;
}

/** Scale notes that do not rub against a borrowed chord note, plus the chord's own notes. */
function passingPitchClasses(scale: readonly number[], chordPcs: readonly number[]): number[] {
  const outside = chordPcs.filter((c) => !scale.includes(c));
  const kept = scale.filter((s) => !outside.some((c) => Math.abs(pc(s - c + 6) - 6) === 1));
  return [...new Set([...kept, ...chordPcs])].sort((a, b) => a - b);
}

/** The notes that fit over a chord: its own notes, and the key's pentatonic minus anything a semitone from a chord note. */
export function fitPitchClasses(mode: ProgressionEntry['mode'], key: PitchClass, chordPcs: readonly number[]): number[] {
  const penta = PENTATONIC[mode].map((d) => pc((key as number) + d));
  const kept = penta.filter((p) => chordPcs.includes(p) || !chordPcs.some((c) => Math.abs(pc(p - c + 6) - 6) === 1));
  return [...new Set([...kept, ...chordPcs])].sort((a, b) => a - b);
}

function pitchesIn(pcs: readonly number[], low: number, high: number): number[] {
  const out: number[] = [];
  for (let p = low; p <= high; p++) if (pcs.includes(pc(p))) out.push(p);
  return out;
}

function nearest(candidates: readonly number[], target: number, preferUp = true): number {
  let best = candidates[0] ?? target;
  for (const c of candidates) {
    const d = Math.abs(c - target);
    const bd = Math.abs(best - target);
    if (d < bd || (d === bd && (preferUp ? c > best : c < best))) best = c;
  }
  return best;
}

interface Motif {
  rhythm: readonly number[];
  /** Scale steps from each sounding note to the next. */
  steps: number[];
  /** Semitones from the last note to aim the first one at, so a repeated motif starts the same way. */
  lead: number;
}

const STEP_CHOICES = [-2, -1, -1, -1, 0, 1, 1, 1, 2, 3, -3];

function makeMotif(rhythm: readonly number[], random: () => number): Motif {
  const sounding = rhythm.filter((r) => r > 0).length;
  const steps: number[] = [];
  let drift = 0;
  for (let i = 1; i < sounding; i++) {
    let step = pick(STEP_CHOICES, random) ?? 1;
    // Keep a bar from wandering off in one direction.
    if (Math.abs(drift + step) > 3) step = -Math.sign(drift) * Math.abs(step === 0 ? 1 : step);
    drift += step;
    steps.push(step);
  }
  return { rhythm, steps, lead: pick([-2, 0, 0, 2, 4, -4], random) ?? 0 };
}

interface PlacedNote {
  pitch: number;
  startTick: number;
  durationTicks: number;
  hand: 'L' | 'R';
}

interface MelodyContext {
  scale: readonly number[];
  key: PitchClass;
  register: { low: number; high: number; centre: number };
}

/** One bar of tune over `bar`'s chord, starting from `previous`; `ending` makes the last note settle (home note when the chord has it). */
function melodyBar(
  bar: Bar,
  motif: Motif,
  previous: number,
  startTick: number,
  ctx: MelodyContext,
  ending: 'open' | 'home' | undefined,
): { notes: PlacedNote[]; last: number } {
  const chordPcs = [...new Set(bar.chord.midiNotes.map((m) => pc(m as number)))];
  const chordPitches = pitchesIn(chordPcs, ctx.register.low, ctx.register.high);
  const stepPitches = pitchesIn(passingPitchClasses(ctx.scale, chordPcs), ctx.register.low, ctx.register.high);
  const notes: PlacedNote[] = [];
  let offset = 0;
  let soundingIndex = 0;
  let current = previous;
  const soundingCount = motif.rhythm.filter((r) => r > 0).length;
  for (const length of motif.rhythm) {
    if (length < 0) {
      offset += -length;
      continue;
    }
    const isLast = soundingIndex === soundingCount - 1;
    const isStrong = offset === 0 || offset === 4 || length >= 4;
    let pitch: number;
    if (soundingIndex === 0) {
      // Pull back towards the middle of the register so the tune never drifts to an edge.
      const aim = current + motif.lead + Math.sign(ctx.register.centre - current) * (Math.abs(ctx.register.centre - current) > 5 ? 3 : 0);
      pitch = nearest(chordPitches, aim);
    } else {
      const step = motif.steps[soundingIndex - 1] ?? 0;
      const from = stepPitches.indexOf(nearest(stepPitches, current));
      // At the edge of the register the tune turns round rather than sticking on one key.
      const index = from + step >= 0 && from + step < stepPitches.length ? from + step : from - step;
      pitch = stepPitches[Math.max(0, Math.min(stepPitches.length - 1, index))] ?? current;
      if (isStrong) {
        // Land on a chord note, but keep the step's direction rather than falling back onto the last note.
        const ahead = chordPitches.filter((c) => (step > 0 ? c > current : step < 0 ? c < current : true));
        const back = chordPitches.filter((c) => c !== current);
        pitch = nearest(ahead.length > 0 ? ahead : back.length > 0 ? back : chordPitches, pitch, step >= 0);
      }
    }
    if (isLast && ending) {
      const homePc = pc(ctx.key as number);
      const settle =
        ending === 'home' && chordPcs.includes(homePc)
          ? [homePc]
          : ending === 'home'
            ? [pc(bar.chord.root as number)]
            : chordPcs.filter((c) => c !== pc(bar.chord.root as number));
      const targets = pitchesIn(settle.length > 0 ? settle : chordPcs, ctx.register.low, ctx.register.high);
      pitch = nearest(targets, pitch, false);
    }
    notes.push({
      pitch,
      startTick: startTick + offset * EIGHTH,
      durationTicks: Math.max(EIGHTH / 2, length * EIGHTH - NOTE_GAP_TICKS),
      hand: 'R',
    });
    current = pitch;
    offset += length;
    soundingIndex++;
  }
  return { notes, last: current };
}

function bassRoot(root: PitchClass): number {
  return LH_ROOT_LOW + pc((root as number) - LH_ROOT_LOW);
}

function fifthAbove(chordPcs: readonly number[], rootPc: number): number {
  for (const interval of [7, 6, 8, 5]) if (chordPcs.includes(pc(rootPc + interval))) return interval;
  return 7;
}

function bassBar(bar: Bar, pattern: readonly PatternStep[], startTick: number): PlacedNote[] {
  const rootPc = pc(bar.chord.root as number);
  const chordPcs = bar.chord.midiNotes.map((m) => pc(m as number));
  const root = bassRoot(bar.chord.root);
  const pitchOf: Record<Voice, number> = { R: root, '5': root + fifthAbove(chordPcs, rootPc), '8': root + 12 };
  const notes: PlacedNote[] = [];
  for (const [offset, length, voices] of pattern) {
    for (const v of voices) {
      notes.push({ pitch: pitchOf[v], startTick: startTick + offset * EIGHTH, durationTicks: length * EIGHTH - NOTE_GAP_TICKS, hand: 'L' });
    }
  }
  return notes;
}

/** The home chord's notes stacked from middle C up, for the right hand's last chord. */
function closingChord(tonic: ChordEntry): number[] {
  const pcs = [...new Set(tonic.midiNotes.map((m) => pc(m as number)))].slice(0, 3);
  const root = 60 + pc((tonic.root as number) - 60);
  return pcs.map((p) => root + pc(p - (tonic.root as number)));
}

function titleFor(moods: readonly string[], random: () => number): string {
  const words = TITLE_WORDS[moods.find((m) => TITLE_WORDS[m]) ?? ''] ?? DEFAULT_TITLE_WORDS;
  return `${pick(words, random) ?? 'Simple'} ${pick(TITLE_NOUNS, random) ?? 'Song'}`;
}

function bpmFor(moods: readonly string[]): number {
  if (moods.some((m) => SLOW_MOODS.has(m)) && !moods.some((m) => QUICK_MOODS.has(m))) return 72;
  if (moods.some((m) => QUICK_MOODS.has(m))) return 96;
  return 84;
}

export function freePlaySongId(request: SongRequest): string {
  return `${FREE_PLAY_SONG_PREFIX}${request.seed}-${request.length}-${request.level}`;
}

/** The song page's address for a request; the seed in it is the whole song. */
export function freePlaySongHref(request: SongRequest): string {
  const parts = [`seed=${request.seed}`, `length=${request.length}`, `level=${request.level}`];
  if (request.mood) parts.push(`mood=${encodeURIComponent(request.mood)}`);
  if (request.key !== undefined) parts.push(`key=${request.key as number}`);
  return `/studio/free-play/song?${parts.join('&')}`;
}

/**
 * Writes the song, or undefined when the catalogue has nothing to build one from.
 * The mood narrows the verse's progression when any song progression has it, and the
 * key fixes it when given; the chorus and bridge are drawn from the same key and mode.
 */
export function composeSong(catalogue: ChordIndex, request: SongRequest): FreePlaySong | undefined {
  const random = seededRandom(request.seed);
  const byId = new Map(catalogue.chords.map((c) => [c.id, c]));
  const pool = songProgressions(catalogue.progressions).filter((p) => p.chordIds.every((id) => byId.has(id)));
  const keyed = request.key === undefined ? pool : pool.filter((p) => p.key === request.key);
  const moody = request.mood ? keyed.filter((p) => p.moods.includes(request.mood!)) : keyed;
  const verse = pick(moody.length > 0 ? moody : keyed, random);
  if (!verse) return undefined;
  const { chorus, bridge } = choosePartners(pool, verse, random);
  const tonic = byId.get(chordId(verse.key, verse.mode === 'minor' ? 'min' : 'maj'));
  if (!tonic) return undefined;

  const scale = SCALE[verse.mode].map((d) => pc((verse.key as number) + d));
  const level = request.level;
  const moods = verse.moods;
  const bpm = bpmFor(request.mood ? [request.mood] : moods);
  const notes: PlacedNote[] = [];
  const harmony: HarmonyWindow[] = [];
  const markers: ChordMarker[] = [];
  const parts: SongPart[] = [];
  const sections: Section[] = [];
  // A section's tune is written the first time it is heard and played again each time it returns.
  const tunes = new Map<string, Motif[]>();
  let tick = 0;
  let previousPitch = MELODY_REGISTER.verse.centre;
  let lastMarkedChord = '';

  const addBarHarmony = (bar: Bar, at: number): void => {
    const chordPcs = [...new Set(bar.chord.midiNotes.map((m) => pc(m as number)))].sort((a, b) => a - b);
    harmony.push({ startTick: asTicks(at), endTick: asTicks(at + BAR), chordPitchClasses: chordPcs, fitPitchClasses: fitPitchClasses(verse.mode, verse.key, chordPcs) });
    if (bar.chordId !== lastMarkedChord) {
      markers.push({ atTick: asTicks(at), symbol: chordSymbolOfId(bar.chordId) });
      lastMarkedChord = bar.chordId;
    }
  };

  const form = planForm(request.length, verse, chorus, bridge);
  for (const [partIndex, part] of form.entries()) {
    const partStart = tick;
    lastMarkedChord = ''; // every section shows its first chord, even when it carries on from the last
    if (part.kind === 'outro') {
      const tonicBar: Bar = { chord: tonic, chordId: tonic.id };
      addBarHarmony(tonicBar, tick);
      notes.push(...bassBar(tonicBar, LH_PATTERNS.halves!, tick));
      const settle = melodyBar(tonicBar, { rhythm: [4, 4], steps: [-1], lead: 0 }, previousPitch, tick, { scale, key: verse.key, register: MELODY_REGISTER.verse }, 'home');
      notes.push(...settle.notes);
      tick += BAR;
      addBarHarmony(tonicBar, tick);
      notes.push(...bassBar(tonicBar, LH_PATTERNS.hold!, tick));
      for (const pitch of closingChord(tonic)) notes.push({ pitch, startTick: tick, durationTicks: BAR - NOTE_GAP_TICKS, hand: 'R' });
      tick += BAR;
    } else {
      const bars = barsOf(part.progression, byId);
      if (!bars) return undefined;
      if (part.kind === 'intro') {
        // The left hand alone, slow, over the verse's chords: the band counting you in.
        for (const bar of bars.slice(0, 4)) {
          addBarHarmony(bar, tick);
          notes.push(...bassBar(bar, LH_PATTERNS.hold!, tick));
          tick += BAR;
        }
      } else {
        const kind = part.kind;
        const register = MELODY_REGISTER[kind];
        const ctx: MelodyContext = { scale, key: verse.key, register };
        const tuneKey = `${kind}:${part.progression.id}`;
        let motifs = tunes.get(tuneKey);
        if (!motifs) {
          motifs = writeTune(bars.length, level, random);
          tunes.set(tuneKey, motifs);
        }
        const isLastBeforeOutro = form[partIndex + 1]?.kind === 'outro';
        for (let pass = 0; pass < part.passes; pass++) {
          const isFinalPass = pass === part.passes - 1;
          // Every pass starts its tune from the same place, so a section that comes back sounds the same.
          previousPitch = register.centre;
          bars.forEach((bar, i) => {
            addBarHarmony(bar, tick);
            notes.push(...bassBar(bar, LH_PATTERNS[LH_BY_LEVEL[level][kind]]!, tick));
            const isPhraseEnd = (i + 1) % 4 === 0;
            const isSectionEnd = i === bars.length - 1;
            const ending = isSectionEnd ? (isFinalPass && isLastBeforeOutro ? 'home' : 'open') : isPhraseEnd ? 'open' : undefined;
            const motif = motifs![i] ?? motifs![0]!;
            const written = melodyBar(bar, motif, previousPitch, tick, ctx, ending);
            notes.push(...written.notes);
            previousPitch = written.last;
            tick += BAR;
          });
        }
      }
    }
    const label = PART_LABEL[part.kind];
    const count = parts.filter((p) => p.kind === part.kind).length;
    parts.push({ kind: part.kind, label, progressionId: part.progression.id, startTick: asTicks(partStart), endTick: asTicks(tick) });
    sections.push({
      id: `${part.kind}-${count + 1}`,
      label,
      startTick: asTicks(partStart),
      endTick: asTicks(tick),
      barRange: [partStart / BAR + 1, tick / BAR],
      kind: 'quest',
    });
  }

  const outroStart = parts[parts.length - 1]?.startTick ?? asTicks(tick);
  const arrangementId = freePlaySongId(request);
  const tracks = toTracks(notes);
  return {
    title: titleFor(request.mood ? [request.mood, ...moods] : moods, random),
    key: verse.key,
    mode: verse.mode,
    moods,
    bpm,
    parts,
    harmony,
    rightHandRange: { ...RIGHT_HAND },
    arrangement: {
      id: arrangementId,
      pieceId: arrangementId,
      difficulty: level === 1 ? 1 : 2,
      tempoMap: [
        { atTick: asTicks(0), bpm },
        { atTick: asTicks((outroStart as number) + BAR), bpm: Math.round(bpm * OUTRO_SLOWDOWN) },
      ],
      timeSig: [4, 4],
      keySig: verse.name,
      tracks,
      sections,
      analysis: { pitchRange: 0, handPositionChanges: 0, rhythmicVocabulary: 0, handIndependence: 0, accidentalDensity: 0, overall: level === 1 ? 1 : 2 },
      chordMarkers: markers,
    },
  };
}

/** The tune for one section: phrases of motif a, motif b, a again, then a settling bar. */
function writeTune(barCount: number, level: SongLevel, random: () => number): Motif[] {
  const a = makeMotif(pick(MOTIF_RHYTHMS[level], random) ?? [4, 4], random);
  const b = random() < 0.3 ? a : makeMotif(pick(MOTIF_RHYTHMS[level], random) ?? [2, 2, 4], random);
  const motifs: Motif[] = [];
  for (let i = 0; i < barCount; i++) {
    const position = i % 4;
    if (position === 3) motifs.push(makeMotif(pick(CADENCE_RHYTHMS[level], random) ?? [8], random));
    else motifs.push(position === 1 ? b : a);
  }
  return motifs;
}

/** `both` (what you play), `rh` and `lh`; notes that begin together share a group, so both hands are one decision in wait mode. */
function toTracks(placed: readonly PlacedNote[]): Track[] {
  const sorted = [...placed].sort((x, y) => x.startTick - y.startTick || x.pitch - y.pitch);
  const both: ContentNote[] = [];
  const rh: ContentNote[] = [];
  const lh: ContentNote[] = [];
  const seen = new Set<string>();
  sorted.forEach((n, i) => {
    // A group holds each key once: if both hands land on one key together, it is played once.
    const slot = `${n.startTick}:${n.pitch}`;
    if (seen.has(slot)) return;
    seen.add(slot);
    const groupId = `t${n.startTick}`;
    const base = { pitch: asMidiPitch(n.pitch), startTick: asTicks(n.startTick), durationTicks: asTicks(Math.max(1, n.durationTicks)), groupId };
    both.push({ ...base, id: `n${i}`, trackId: 'both' });
    if (n.hand === 'R') rh.push({ ...base, id: `r${i}`, trackId: 'rh' });
    else lh.push({ ...base, id: `l${i}`, trackId: 'lh' });
  });
  return [
    { id: 'both', role: 'melody', notes: both },
    { id: 'rh', role: 'rh', hand: 'R', notes: rh },
    { id: 'lh', role: 'lh', hand: 'L', notes: lh },
  ];
}

/** The harmony under `tick`, for the light-up; undefined past the end. */
export function harmonyAt(windows: readonly HarmonyWindow[], tick: number): HarmonyWindow | undefined {
  let lo = 0;
  let hi = windows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const w = windows[mid]!;
    if (tick < (w.startTick as number)) hi = mid - 1;
    else if (tick >= (w.endTick as number)) lo = mid + 1;
    else return w;
  }
  return undefined;
}

/** Which part of the song `tick` is in. */
export function partAt(parts: readonly SongPart[], tick: number): SongPart | undefined {
  return parts.find((p) => tick >= (p.startTick as number) && tick < (p.endTick as number)) ?? (tick >= 0 ? parts[parts.length - 1] : undefined);
}
