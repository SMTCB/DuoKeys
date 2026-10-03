// FR-STU-015 — turning typed chord text into chords. Pure: no I/O, no clock.
//
// Accepts what an adult would copy off a chart: chord symbols ("C G Am F",
// "Dm7 G7 Cmaj7", "Bb/D") or Roman numerals in a chosen key ("I V vi IV",
// "ii7 V7 I", "bVII"). Chords are built from standard interval formulas, the
// same way TA-CNT-006 builds the catalogue. A slash chord's bass note is
// dropped: the explorer checks pitch classes, so the chord is what matters.

import { asMidiPitch, type MidiPitch } from '../midi/decode';
import { asPitchClass, type ChordEntry, type PitchClass } from './chordTypes';
import { chordId, NOTE_NAMES, QUALITIES } from './chordCatalogue';
import { QUALITY_OF_SUFFIX, qualityOfRomanSuffix, SUFFIX_OF_QUALITY } from './chordQualities';

/** Every chord quality the catalogue knows (the full free-midi-chords chord-type set). */
export const CHORD_QUALITIES = QUALITIES;

const ROMAN: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];
const NOTE_LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export interface ParsedChord {
  root: PitchClass;
  quality: string; // a key into CHORD_QUALITIES
}

export type ChordParseResult = { ok: true; chord: ParsedChord } | { ok: false; error: string };

function accidentalOffset(c: string | undefined): number {
  return c === '#' || c === '♯' ? 1 : c === 'b' || c === '♭' ? -1 : 0;
}

function parseSymbol(token: string): ChordParseResult {
  const letter = token[0]?.toUpperCase() ?? '';
  const base = NOTE_LETTER_PC[letter];
  if (base === undefined) return { ok: false, error: `"${token}" is not a chord` };
  const accidental = accidentalOffset(token[1]);
  const suffix = token.slice(accidental === 0 ? 1 : 2);
  const quality = QUALITY_OF_SUFFIX[suffix];
  if (quality === undefined) return { ok: false, error: `Don't know the chord type "${suffix}" in "${token}"` };
  return { ok: true, chord: { root: asPitchClass(base + accidental), quality } };
}

function parseRoman(token: string, key: PitchClass, mode: 'major' | 'minor'): ChordParseResult {
  const match = /^([#b♯♭]?)([ivIV]+)(.*)$/.exec(token);
  const numeral = match?.[2];
  const degree = numeral === undefined ? undefined : ROMAN[numeral.toUpperCase()];
  if (!match || numeral === undefined || degree === undefined) return { ok: false, error: `"${token}" is not a chord` };
  const isUpper = numeral === numeral.toUpperCase();
  const suffix = match[3] ?? '';
  // A bare numeral takes its quality from its case; a suffix is read like a chord symbol's, with 6/7/9 following the case.
  const quality = qualityOfRomanSuffix(isUpper, suffix);
  if (quality === undefined) return { ok: false, error: `Don't know the chord type "${suffix}" in "${token}"` };
  const steps = mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const root = asPitchClass((key as number) + steps[degree]! + accidentalOffset(match[1]));
  return { ok: true, chord: { root, quality } };
}

/** One chord, symbol or Roman numeral (Roman needs the key it is in). */
export function parseChordToken(token: string, key: PitchClass, mode: 'major' | 'minor'): ChordParseResult {
  const withoutBass = token.replace(/\/[A-Ga-g][#b]?$/, '');
  if (withoutBass === '') return { ok: false, error: `"${token}" is not a chord` };
  const looksRoman = /^[#b♯♭]?[ivIV]+(?:$|[^a-zA-Z]|maj|M7|M9|add|sus|dim|m7b5)/.test(withoutBass) && !/^[A-G]/.test(withoutBass);
  return looksRoman ? parseRoman(withoutBass, key, mode) : parseSymbol(withoutBass);
}

export interface ParsedProgression {
  chords: ParsedChord[];
  errors: string[];
}

/** Splits free text into chord tokens, then parses each. Every bad token is reported, not just the first. */
export function parseProgressionText(text: string, key: PitchClass, mode: 'major' | 'minor'): ParsedProgression {
  const rawTokens = text.split(/[\s|,;>→]+/).filter((t) => t.length > 0);
  const chords: ParsedChord[] = [];
  const errors: string[] = [];
  for (const raw of rawTokens) {
    // "I-V-vi-IV" is one token to the splitter; try it as dash-separated chords first.
    if (raw.includes('-') && raw.length > 1) {
      const parts = raw.split('-').filter((p) => p.length > 0);
      const parsed = parts.map((p) => parseChordToken(p, key, mode));
      if (parts.length > 1 && parsed.every((r) => r.ok)) {
        for (const r of parsed) if (r.ok) chords.push(r.chord);
        continue;
      }
    }
    const result = parseChordToken(raw, key, mode);
    if (result.ok) chords.push(result.chord);
    else errors.push(result.error);
  }
  return { chords, errors };
}

/** Catalogue-style id for a chord: "C#-min7". */
export function idOfChord(chord: ParsedChord): string {
  return chordId(chord.root, chord.quality);
}

/** Reads an id such as "C#-min7" back into a chord; undefined if it names a root or quality we do not know. */
export function chordFromId(id: string): ParsedChord | undefined {
  const cut = id.indexOf('-');
  if (cut < 1) return undefined;
  const root = NOTE_NAMES.indexOf(id.slice(0, cut));
  const quality = id.slice(cut + 1);
  if (root < 0 || CHORD_QUALITIES[quality] === undefined) return undefined;
  return { root: asPitchClass(root), quality };
}

const MIDDLE_C = 60;

/** One voicing around middle C, as TA-CNT-006 generates them. */
export function chordEntryFromId(id: string): ChordEntry | undefined {
  const parsed = chordFromId(id);
  if (!parsed) return undefined;
  const intervals = CHORD_QUALITIES[parsed.quality]!;
  const midiNotes: MidiPitch[] = intervals.map((i) => asMidiPitch(MIDDLE_C + (parsed.root as number) + i));
  return { id, root: parsed.root, quality: parsed.quality, midiNotes };
}

/** How a chord is written on a chart: "C#-min7" → "C#m7". */
export function chordSymbolOfId(id: string): string {
  const parsed = chordFromId(id);
  if (!parsed) return id;
  return `${NOTE_NAMES[parsed.root as number]}${SUFFIX_OF_QUALITY[parsed.quality] ?? ''}`;
}
