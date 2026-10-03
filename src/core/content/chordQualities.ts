// TA-CNT-006 — every chord quality the catalogue knows, in one table.
//
// Interval formulas are standard chord theory (semitones from the root).
// The full set matches the chord types of ldrolez/free-midi-chords (MIT; its
// "All chords" folder), whose files were read to confirm each formula. Pure
// data and string handling: nothing here touches a clock or the platform.

export type ChordGroup = 'triad' | 'seventh' | 'other';

export interface QualityDef {
  id: string;
  intervals: readonly number[];
  /** Written after the root on a chart: "C" + "m7" → "Cm7". */
  suffix: string;
  group: ChordGroup;
}

const q = (id: string, intervals: readonly number[], suffix: string, group: ChordGroup): QualityDef => ({
  id,
  intervals,
  suffix,
  group,
});

// Order matters only for display: it is the order the picker lists them in.
export const QUALITY_DEFS: readonly QualityDef[] = [
  q('maj', [0, 4, 7], '', 'triad'),
  q('min', [0, 3, 7], 'm', 'triad'),
  q('dim', [0, 3, 6], 'dim', 'triad'),
  q('aug', [0, 4, 8], 'aug', 'triad'),
  q('sus2', [0, 2, 7], 'sus2', 'triad'),
  q('sus4', [0, 5, 7], 'sus4', 'triad'),
  q('majFlat5', [0, 4, 6], '(b5)', 'triad'),

  q('dom7', [0, 4, 7, 10], '7', 'seventh'),
  q('maj7', [0, 4, 7, 11], 'maj7', 'seventh'),
  q('min7', [0, 3, 7, 10], 'm7', 'seventh'),
  q('min7b5', [0, 3, 6, 10], 'm7b5', 'seventh'),
  q('dim7', [0, 3, 6, 9], 'dim7', 'seventh'),
  q('dom9', [0, 4, 7, 10, 14], '9', 'seventh'),
  q('maj9', [0, 4, 7, 11, 14], 'maj9', 'seventh'),
  q('min9', [0, 3, 7, 10, 14], 'm9', 'seventh'),
  q('min7b9b5', [0, 3, 6, 10, 13], 'm7b9b5', 'seventh'),

  q('five', [0, 7], '5', 'other'),
  q('maj6', [0, 4, 7, 9], '6', 'other'),
  q('min6', [0, 3, 7, 9], 'm6', 'other'),
  q('maj69', [0, 4, 7, 9, 14], '6/9', 'other'),
  q('min69', [0, 3, 7, 9, 14], 'm6/9', 'other'),
  q('majAdd9', [0, 4, 7, 14], 'add9', 'other'),
  q('minAdd9', [0, 3, 7, 14], 'madd9', 'other'),
  q('majAdd2', [0, 2, 4, 7], 'add2', 'other'),
  q('majAdd4', [0, 4, 5, 7], 'add4', 'other'),
  q('minAdd4', [0, 3, 5, 7], 'madd4', 'other'),
  q('majAdd11', [0, 4, 7, 17], 'add11', 'other'),
  q('sus4add9', [0, 5, 7, 14], 'sus4add9', 'other'),
  q('dom7sus4', [0, 5, 7, 10], '7sus4', 'other'),
  q('dom9sus4', [0, 5, 7, 10, 14], '9sus4', 'other'),
  q('dom7b5', [0, 4, 6, 10], '7b5', 'other'),
  q('dom7s5', [0, 4, 8, 10], '7#5', 'other'),
  q('dom7b9', [0, 4, 7, 10, 13], '7b9', 'other'),
  q('dom7s11', [0, 4, 7, 10, 18], '7#11', 'other'),
  q('maj7s5', [0, 4, 8, 11], 'maj7#5', 'other'),
  q('min7s5', [0, 3, 8, 10], 'm7#5', 'other'),
  q('dim6', [0, 3, 6, 8], 'dim6', 'other'),
  q('minMaj7', [0, 3, 7, 11], 'mMaj7', 'other'),
  q('min7add11', [0, 3, 7, 10, 17], 'm7add11', 'other'),
  q('minMaj7add11', [0, 3, 7, 11, 17], 'mMaj7add11', 'other'),
];

export const QUALITY_INTERVALS: Record<string, readonly number[]> = Object.fromEntries(
  QUALITY_DEFS.map((d) => [d.id, d.intervals]),
);

export const SUFFIX_OF_QUALITY: Record<string, string> = Object.fromEntries(QUALITY_DEFS.map((d) => [d.id, d.suffix]));

export const GROUP_OF_QUALITY: Record<string, ChordGroup> = Object.fromEntries(QUALITY_DEFS.map((d) => [d.id, d.group]));

export const GROUP_LABELS: Record<ChordGroup, string> = {
  triad: 'Triads',
  seventh: '7ths & 9ths',
  other: 'Other',
};

/** Other ways a chart (or free-midi-chords' filenames) writes a chord type. Our own suffixes are added below. */
const SUFFIX_ALIASES: Record<string, string> = {
  maj: 'maj',
  M: 'maj',
  min: 'min',
  '-': 'min',
  '°': 'dim',
  o: 'dim',
  '+': 'aug',
  dom7: 'dom7',
  M7: 'maj7',
  Δ: 'maj7',
  Δ7: 'maj7',
  min7: 'min7',
  '-7': 'min7',
  sus: 'sus4',
  '69': 'maj69',
  '6/9': 'maj69',
  m69: 'min69',
  min6: 'min6',
  M6: 'maj6',
  M9: 'maj9',
  min9: 'min9',
  '°7': 'dim7',
  ø: 'min7b5',
  ø7: 'min7b5',
  'M-5': 'majFlat5',
  '2': 'majAdd2',
  '7-5': 'dom7b5',
  '7+5': 'dom7s5',
  '7-9': 'dom7b9',
  '7+11': 'dom7s11',
  'M7+5': 'maj7s5',
  'maj7+5': 'maj7s5',
  'm7-5': 'min7b5',
  'm7+5': 'min7s5',
  mM7: 'minMaj7',
  mM7add11: 'minMaj7add11',
  m7b9b5: 'min7b9b5',
};

export const QUALITY_OF_SUFFIX: Record<string, string> = {
  ...SUFFIX_ALIASES,
  ...Object.fromEntries(QUALITY_DEFS.map((d) => [d.suffix, d.id])),
};

/**
 * The quality of a Roman-numeral chord token's suffix. Case decides what a bare
 * numeral or a 6/7/9/add9 means (upper → major family, lower → minor family);
 * everything else reads like a chord symbol. undefined if the suffix is unknown.
 */
export function qualityOfRomanSuffix(isUpperNumeral: boolean, suffix: string): string | undefined {
  switch (suffix) {
    case '':
      return isUpperNumeral ? 'maj' : 'min';
    case '6':
      return isUpperNumeral ? 'maj6' : 'min6';
    case '7':
      return isUpperNumeral ? 'dom7' : 'min7';
    case '9':
      return isUpperNumeral ? 'dom9' : 'min9';
    case 'add9':
      return isUpperNumeral ? 'majAdd9' : 'minAdd9';
    case '69':
      return isUpperNumeral ? 'maj69' : 'min69';
    default:
      return QUALITY_OF_SUFFIX[suffix];
  }
}
