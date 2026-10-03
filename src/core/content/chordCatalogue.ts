// TA-CNT-006 — chord & progression catalogue generation.
//
// Progression *sequences* (Roman-numeral degree/quality tokens) and their
// mood tags are ported as text data from ldrolez/free-midi-chords
// (https://github.com/ldrolez/free-midi-chords, MIT licence) — see
// progressionData.ts and content/licences.json
// ("free-midi-chords-progressions"). That repository's own MIDI files are
// not used: parsing standard MIDI files needs a binary SMF reader that does
// not exist in this codebase (decode.ts only decodes live Web MIDI
// messages, not .mid files), a separate, nontrivial piece of work. Instead,
// every chord's actual voicing (midiNotes) is generated deterministically
// from standard chord-interval formulas applied to the ported degree/quality
// tokens — public-domain music theory, not audio or note data scraped from
// any corpus.
//
// The "12-bar-blues (turnaround)" progression is not part of the ported set
// (free-midi-chords has no matching entry); it remains a hand-authored stock
// progression, named explicitly by FR-STU-012.

import { asMidiPitch, type MidiPitch } from '../midi/decode';
import { asPitchClass, type ChordEntry, type ChordIndex, type PitchClass, type ProgressionEntry } from './chordTypes';
import { MAJOR_PROGRESSION_TEMPLATES, MINOR_PROGRESSION_TEMPLATES, type ProgressionTemplate } from './progressionData';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIDDLE_C = 60;

// Interval formulas from the root, in semitones — standard chord theory.
const QUALITIES: Record<string, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  five: [0, 7],
  majFlat5: [0, 4, 6],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj69: [0, 4, 7, 9, 14],
  min69: [0, 3, 7, 9, 14],
  majAdd9: [0, 4, 7, 14],
  minAdd9: [0, 3, 7, 14],
};

function chordId(root: PitchClass, quality: string): string {
  return `${NOTE_NAMES[root as number]}-${quality}`;
}

function buildChord(root: PitchClass, quality: string): ChordEntry {
  const intervals = QUALITIES[quality]!;
  const midiNotes: MidiPitch[] = intervals.map((i) => asMidiPitch(MIDDLE_C + (root as number) + i));
  return { id: chordId(root, quality), root, quality, midiNotes };
}

// Major-scale diatonic triad qualities by scale degree: I ii iii IV V vi vii°.
const DIATONIC_DEGREE_QUALITY = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'] as const;
const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_STEPS = [0, 2, 3, 5, 7, 8, 10];

/** The seven scale-degree chord ids (I ii iii IV V vi vii°) for a major key — exported for the chord explorer UI. */
export function diatonicChordIds(keyRoot: PitchClass): string[] {
  return MAJOR_SCALE_STEPS.map((step, i) =>
    chordId(asPitchClass((keyRoot as number) + step), DIATONIC_DEGREE_QUALITY[i]!),
  );
}

const ROMAN_DEGREE: Record<string, number> = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

// A degree token is a leading Roman numeral (letters I/V only, upper- or
// lower-case) followed by an optional quality suffix, e.g. "IV", "iim7",
// "Vsus2", "IM-5". Case of the numeral is the diatonic-default triad
// quality (upper = major, lower = minor); the suffix overrides or extends
// it. This is exactly how free-midi-chords' chords.py writes its tokens.
const DEGREE_TOKEN = /^([iIvV]+)(.*)$/;

interface ParsedDegreeToken {
  degreeIndex: number; // 0-6, I..VII
  quality: string; // a key into QUALITIES
}

function resolveQuality(isUpperNumeral: boolean, suffix: string): string {
  switch (suffix) {
    case '':
      return isUpperNumeral ? 'maj' : 'min';
    case '5':
      return 'five';
    case '6':
      return isUpperNumeral ? 'maj6' : 'min6';
    case '69':
      return isUpperNumeral ? 'maj69' : 'min69';
    case '7':
      return isUpperNumeral ? 'dom7' : 'min7';
    case 'M-5':
      return 'majFlat5';
    case 'add9':
      return isUpperNumeral ? 'majAdd9' : 'minAdd9';
    case 'dim':
      return 'dim';
    case 'dom7':
      return 'dom7';
    case 'm7':
      return 'min7';
    case 'sus2':
      return 'sus2';
    case 'sus4':
      return 'sus4';
    default:
      throw new Error(`Unknown chord-quality suffix: "${suffix}"`);
  }
}

/** Parses a free-midi-chords-style degree token, e.g. "IV", "iim7", "Vsus2". Exported for tests. */
export function parseDegreeToken(token: string): ParsedDegreeToken {
  const match = DEGREE_TOKEN.exec(token);
  if (!match) throw new Error(`Unrecognised degree token: "${token}"`);
  const numeral = match[1]!;
  const suffix = match[2]!;
  const degreeIndex = ROMAN_DEGREE[numeral.toUpperCase()];
  if (degreeIndex === undefined) throw new Error(`Unrecognised scale-degree numeral: "${numeral}"`);
  const isUpperNumeral = numeral === numeral.toUpperCase();
  return { degreeIndex, quality: resolveQuality(isUpperNumeral, suffix) };
}

function chordIdForDegree(keyRoot: PitchClass, mode: 'major' | 'minor', token: string): string {
  const { degreeIndex, quality } = parseDegreeToken(token);
  const steps = mode === 'major' ? MAJOR_SCALE_STEPS : MINOR_SCALE_STEPS;
  const root = asPitchClass((keyRoot as number) + steps[degreeIndex]!);
  return chordId(root, quality);
}

function buildTemplateProgression(
  keyRoot: PitchClass,
  mode: 'major' | 'minor',
  template: ProgressionTemplate,
): ProgressionEntry {
  const name = template.tokens.join('-');
  return {
    id: `${NOTE_NAMES[keyRoot as number]}-${name}`,
    name,
    key: keyRoot,
    mode,
    moods: template.moods,
    chordIds: template.tokens.map((t) => chordIdForDegree(keyRoot, mode, t)),
    suggestedBpm: 90,
  };
}

// FR-STU-012 names this one explicitly; it has no match in the ported
// free-midi-chords list, so it stays hand-authored.
const TWELVE_BAR_BLUES_DEGREES: readonly number[] = [0, 0, 3, 0, 4, 3, 0, 0];

function buildTwelveBarBlues(keyRoot: PitchClass): ProgressionEntry {
  const degreeIds = diatonicChordIds(keyRoot);
  const name = '12-bar-blues (turnaround)';
  return {
    id: `${NOTE_NAMES[keyRoot as number]}-${name}`,
    name,
    key: keyRoot,
    mode: 'major',
    moods: ['Blues'],
    chordIds: TWELVE_BAR_BLUES_DEGREES.map((d) => degreeIds[d]!),
    suggestedBpm: 90,
  };
}

export function generateChordCatalogue(): ChordIndex {
  const chords: ChordEntry[] = [];
  for (let root = 0; root < 12; root++) {
    for (const quality of Object.keys(QUALITIES)) {
      chords.push(buildChord(asPitchClass(root), quality));
    }
  }

  const progressions: ProgressionEntry[] = [];
  for (let keyRoot = 0; keyRoot < 12; keyRoot++) {
    const key = asPitchClass(keyRoot);
    progressions.push(buildTwelveBarBlues(key));
    for (const template of MAJOR_PROGRESSION_TEMPLATES) {
      progressions.push(buildTemplateProgression(key, 'major', template));
    }
    for (const template of MINOR_PROGRESSION_TEMPLATES) {
      progressions.push(buildTemplateProgression(key, 'minor', template));
    }
  }

  return { chords, progressions };
}
