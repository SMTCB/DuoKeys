// FR-STU-015 — a chord progression as a piano grand staff, for OpenSheetMusicDisplay.
//
// toMusicXml.ts draws one melody line; a chord is several notes at once on two
// staves. Each matcher group (one chord) becomes one whole-note measure — the
// score shows *what to play next*, not how long to hold it — so a notation cursor
// stepped once per group lands on exactly the chord the wait matcher is waiting
// for. Notes at or above middle C go on the treble staff, the rest on the bass.
// Documented simplification, like toMusicXml.ts: key signature is always C and
// spelling is sharp-only (matching noteName.ts), so a flat key reads as sharps.

import type { Arrangement, ContentNote } from './types';

const DIVISIONS = 480;
const MEASURE = 4 * DIVISIONS;
const MIDDLE_C = 60;

const STEP_ALTER: ReadonlyArray<readonly [step: string, alter: number]> = [
  ['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0],
  ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0],
];

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function noteXml(pitch: number, isChordTone: boolean, staff: 1 | 2): string {
  const [step, alter] = STEP_ALTER[((pitch % 12) + 12) % 12]!;
  const octave = Math.floor(pitch / 12) - 1;
  return `      <note>${isChordTone ? '\n        <chord/>' : ''}
        <pitch><step>${step}</step>${alter !== 0 ? `<alter>${alter}</alter>` : ''}<octave>${octave}</octave></pitch>
        <duration>${MEASURE}</duration>
        <voice>${staff === 1 ? 1 : 5}</voice>
        <type>whole</type>
        <staff>${staff}</staff>
      </note>`;
}

function restXml(staff: 1 | 2): string {
  return `      <note>
        <rest/>
        <duration>${MEASURE}</duration>
        <voice>${staff === 1 ? 1 : 5}</voice>
        <type>whole</type>
        <staff>${staff}</staff>
      </note>`;
}

function staffXml(pitches: readonly number[], staff: 1 | 2): string {
  if (pitches.length === 0) return restXml(staff);
  return [...pitches].sort((a, b) => a - b).map((p, i) => noteXml(p, i > 0, staff)).join('\n');
}

/** Groups in the order the wait matcher sees them — one per chord. */
export function chordGroups(notes: readonly ContentNote[]): ContentNote[][] {
  const groups = new Map<string, ContentNote[]>();
  for (const n of notes) {
    const g = groups.get(n.groupId);
    if (g) g.push(n);
    else groups.set(n.groupId, [n]);
  }
  return [...groups.values()];
}

/** Pure — no I/O, no DOM (ADR-005). */
export function chordsToMusicXml(arrangement: Arrangement, trackId: string): string {
  const track = arrangement.tracks.find((t) => t.id === trackId);
  if (!track) throw new Error(`chordScoreXml: no track "${trackId}" in arrangement "${arrangement.id}"`);

  const symbolAtTick = new Map((arrangement.chordMarkers ?? []).map((m) => [m.atTick as number, m.symbol]));
  const groups = chordGroups(track.notes);

  const measures = groups
    .map((group, i) => {
      const treble = group.filter((n) => (n.pitch as number) >= MIDDLE_C).map((n) => n.pitch as number);
      const bass = group.filter((n) => (n.pitch as number) < MIDDLE_C).map((n) => n.pitch as number);
      const symbol = symbolAtTick.get(group[0]!.startTick as number);
      const attributes =
        i === 0
          ? `      <attributes>
        <divisions>${DIVISIONS}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves>
        <clef number="1"><sign>G</sign><line>2</line></clef>
        <clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
`
          : '';
      const direction = symbol
        ? `      <direction placement="above">
        <direction-type><words font-weight="bold" font-size="14">${escapeXml(symbol)}</words></direction-type>
        <staff>1</staff>
      </direction>
`
        : '';
      return `    <measure number="${i + 1}">
${attributes}${direction}${staffXml(treble, 1)}
      <backup><duration>${MEASURE}</duration></backup>
${staffXml(bass, 2)}
    </measure>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measures}
  </part>
</score-partwise>
`;
}
