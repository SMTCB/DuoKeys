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
import { QUALITY_INTERVALS, qualityOfRomanSuffix } from './chordQualities';
import {
  MAJOR_PROGRESSION_TEMPLATES,
  MINOR_PROGRESSION_TEMPLATES,
  MODAL_PROGRESSION_TEMPLATES,
  type ProgressionTemplate,
} from './progressionData';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIDDLE_C = 60;

// Interval formulas live in chordQualities.ts (the full free-midi-chords chord-type set).
export const QUALITIES = QUALITY_INTERVALS;

export function chordId(root: PitchClass, quality: string): string {
  return `${NOTE_NAMES[root as number]}-${quality}`;
}

export function buildChord(root: PitchClass, quality: string): ChordEntry {
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
const DEGREE_TOKEN = /^([b#]?)([iIvV]+)(.*)$/;

interface ParsedDegreeToken {
  degreeIndex: number; // 0-6, I..VII
  accidentalOffset: number; // -1 for "b", +1 for "#", else 0 (modal tokens: "bIIIM", "#IVm")
  quality: string; // a key into QUALITIES
}

// What the release's MIDI files do with the shorthand: a bare "7" is the scale's own
// seventh chord (I7 = Imaj7, V7 = dominant, III7 in a minor key = maj7), and a bare
// lowercase numeral on the diminished degree (ii in minor, vii in major) is diminished.
const DIATONIC_TRIAD = {
  major: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  minor: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
} as const;
const DIATONIC_SEVENTH = {
  major: ['maj7', 'min7', 'min7', 'maj7', 'dom7', 'min7', 'min7b5'],
  minor: ['min7', 'min7b5', 'maj7', 'min7', 'min7', 'maj7', 'dom7'],
} as const;

/**
 * Parses a free-midi-chords-style degree token, e.g. "IV", "iim7", "Vsus2", "bIIIM". Exported for tests.
 * Pass the progression's mode to apply the diatonic readings above; without it the token alone decides.
 */
export function parseDegreeToken(token: string, mode?: 'major' | 'minor' | 'modal'): ParsedDegreeToken {
  const match = DEGREE_TOKEN.exec(token);
  if (!match) throw new Error(`Unrecognised degree token: "${token}"`);
  const numeral = match[2]!;
  const suffix = match[3]!;
  const degreeIndex = ROMAN_DEGREE[numeral.toUpperCase()];
  if (degreeIndex === undefined) throw new Error(`Unrecognised scale-degree numeral: "${numeral}"`);
  const quality = qualityOfRomanSuffix(numeral === numeral.toUpperCase(), suffix);
  if (quality === undefined) throw new Error(`Unknown chord-quality suffix: "${suffix}"`);
  const accidentalOffset = match[1] === 'b' ? -1 : match[1] === '#' ? 1 : 0;
  if (mode !== undefined && accidentalOffset === 0) {
    const scale = mode === 'minor' ? 'minor' : 'major';
    if (suffix === '7') return { degreeIndex, accidentalOffset, quality: DIATONIC_SEVENTH[scale][degreeIndex]! };
    if (suffix === '' && numeral !== numeral.toUpperCase() && DIATONIC_TRIAD[scale][degreeIndex] === 'dim') {
      return { degreeIndex, accidentalOffset, quality: 'dim' };
    }
  }
  return { degreeIndex, accidentalOffset, quality };
}

// Major and minor sets number their degrees off the key's own scale; the modal
// set numbers everything off the major (Ionian) scale and marks borrowed
// degrees with b / # — chords.py's convention, see the README's "Modal" note.
function chordIdForDegree(keyRoot: PitchClass, mode: 'major' | 'minor' | 'modal', token: string): string {
  const { degreeIndex, accidentalOffset, quality } = parseDegreeToken(token, mode);
  const steps = mode === 'minor' ? MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS;
  const root = asPitchClass((keyRoot as number) + steps[degreeIndex]! + accidentalOffset);
  return chordId(root, quality);
}

function buildTemplateProgression(
  keyRoot: PitchClass,
  mode: 'major' | 'minor' | 'modal',
  template: ProgressionTemplate,
): ProgressionEntry {
  const name = template.tokens.join('-');
  return {
    id: mode === 'modal' ? `${NOTE_NAMES[keyRoot as number]}-modal:${name}` : `${NOTE_NAMES[keyRoot as number]}-${name}`,
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
    // The release lists the same chords twice under different moods (e.g. "im bVIIM IV im"); the repeat keeps its own entry, id suffixed ~2.
    const seenModalIds = new Set<string>();
    for (const template of MODAL_PROGRESSION_TEMPLATES) {
      const entry = buildTemplateProgression(key, 'modal', template);
      if (seenModalIds.has(entry.id)) entry.id = `${entry.id}~2`;
      seenModalIds.add(entry.id);
      progressions.push(entry);
    }
  }

  return { chords, progressions };
}
