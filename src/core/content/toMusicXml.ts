// TA-REN-003 — Arrangement -> MusicXML, for OpenSheetMusicDisplay (US-3.01).
// Documented simplification: single voice, no rests, no key-signature-aware
// enharmonic spelling (always sharp, matching noteName.ts's display spelling).
// Holds for every current content/sources/*.json file — all eight are single
// melody tracks with gapless, PPQ-480-aligned notes and no chords within a
// track (confirmed by reading them). A track that violates this throws rather
// than silently emitting wrong notation.

import type { Arrangement, ContentNote } from './types';

const DIVISIONS = 480; // == PPQ (TA-CLK-001), so durationTicks maps 1:1 to <duration>.

const DURATION_TYPE: Record<number, string> = {
  1920: 'whole',
  960: 'half',
  480: 'quarter',
  240: 'eighth',
  120: '16th',
  60: '32nd',
};

// Sharp-only spelling, index = pitch % 12. Mirrors noteName.ts's PITCH_CLASS_NAME.
const STEP_ALTER: ReadonlyArray<readonly [step: string, alter: number]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

// Fifths for MusicXML's <key>, major keys only — matches every current
// content/sources/*.json file (all keySig: "C"). Extend as new keys appear.
const MAJOR_KEY_FIFTHS: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5,
};

function pitchToStepAlterOctave(pitch: number): { step: string; alter: number; octave: number } {
  const octave = Math.floor(pitch / 12) - 1;
  const [step, alter] = STEP_ALTER[((pitch % 12) + 12) % 12]!;
  return { step, alter, octave };
}

function durationType(durationTicks: number): string {
  const type = DURATION_TYPE[durationTicks];
  if (!type) {
    throw new Error(`toMusicXml: unsupported durationTicks ${durationTicks} — no MusicXML note-type mapping`);
  }
  return type;
}

/** Also reused by the Studio loop-range picker (US-3.04) to convert measure numbers to ticks. */
export function ticksPerMeasure(timeSig: readonly [number, number]): number {
  const [beats, beatUnit] = timeSig;
  return beats * ((DIVISIONS * 4) / beatUnit);
}

function bucketByMeasure(notes: readonly ContentNote[], perMeasure: number): ContentNote[][] {
  const measures: ContentNote[][] = [];
  for (const note of notes) {
    const index = Math.floor((note.startTick as number) / perMeasure);
    while (measures.length <= index) measures.push([]);
    measures[index]!.push(note);
  }
  if (measures.length === 0) measures.push([]);
  return measures;
}

function noteXml(note: ContentNote): string {
  const { step, alter, octave } = pitchToStepAlterOctave(note.pitch as number);
  const type = durationType(note.durationTicks as number);
  const alterXml = alter !== 0 ? `\n        <alter>${alter}</alter>` : '';
  return `      <note>
        <pitch>
          <step>${step}</step>${alterXml}
          <octave>${octave}</octave>
        </pitch>
        <duration>${note.durationTicks as number}</duration>
        <type>${type}</type>
      </note>`;
}

/** Pure — no I/O, no DOM (ADR-005). Throws on content this simplification can't represent. */
export function arrangementToMusicXml(arrangement: Arrangement, trackId: string): string {
  const track = arrangement.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`toMusicXml: no track "${trackId}" in arrangement "${arrangement.id}"`);

  const fifths = MAJOR_KEY_FIFTHS[arrangement.keySig];
  if (fifths === undefined) {
    throw new Error(`toMusicXml: unsupported keySig "${arrangement.keySig}" — no fifths mapping`);
  }

  const [beats, beatUnit] = arrangement.timeSig;
  const perMeasure = ticksPerMeasure(arrangement.timeSig);
  const measures = bucketByMeasure(track.notes, perMeasure);

  const measuresXml = measures
    .map((measureNotes, i) => {
      const attributes =
        i === 0
          ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key>
          <fifths>${fifths}</fifths>
        </key>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatUnit}</beat-type>
        </time>
      </attributes>
`
          : '';
      const notesXml = measureNotes.map(noteXml).join('\n');
      return `    <measure number="${i + 1}">
${attributes}${notesXml}
    </measure>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>${track.role}</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>
`;
}
