import { describe, expect, it } from 'vitest';
import { parseMusicXml } from './parseMusicXml';
import { buildArrangementFromSource } from './buildArrangement';

// A single-part <score-partwise> shell around one or more <measure> bodies,
// so each test only has to write the notes it cares about — TS-U-CNT-022.
function score(measures: string, opts: { title?: string; parts?: number } = {}): string {
  const partBody = `<part id="P1">${measures}</part>`;
  const parts = opts.parts === 2 ? `${partBody}<part id="P2">${measures}</part>` : partBody;
  return `<?xml version="1.0"?>
<score-partwise version="3.1">
  ${opts.title ? `<work><work-title>${opts.title}</work-title></work>` : ''}
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
    ${opts.parts === 2 ? '<score-part id="P2"><part-name>Piano 2</part-name></score-part>' : ''}
  </part-list>
  ${parts}
</score-partwise>`;
}

const ATTRS = '<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>';

describe('parseMusicXml', () => {
  it('parses a single-staff melody with a rest into one "melody" track', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <direction><sound tempo="120"/></direction>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <note><rest/><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>8</duration><voice>1</voice><staff>1</staff></note>
    </measure>`, { title: 'Test Tune' });

    const source = parseMusicXml(xml, { id: 'test-tune', barsPerQuest: 1 });
    expect(source.title).toBe('Test Tune');
    expect(source.tempoBpm).toBe(120);
    expect(source.timeSig).toEqual([4, 4]);
    expect(source.keySig).toBe('C');
    expect(source.tracks).toEqual([
      {
        id: 'melody',
        role: 'melody',
        notes: [
          { pitch: 'C4', durationTicks: 480 },
          { durationTicks: 480, rest: true },
          { pitch: 'D4', durationTicks: 960 },
        ],
      },
    ]);

    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.tracks[0]!.notes).toEqual([
      { id: 'n1', pitch: 60, startTick: 0, durationTicks: 480, groupId: 'g0', trackId: 'melody' },
      { id: 'n3', pitch: 62, startTick: 960, durationTicks: 960, groupId: 'g1', trackId: 'melody' },
    ]);
  });

  it('splits two staves into rh/lh tracks by <staff>, and groups a <chord/> note onto its base note', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><staff>2</staff></note>
      <note><chord/><pitch><step>G</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><staff>2</staff></note>
    </measure>`);

    const source = parseMusicXml(xml, { id: 'two-staff', barsPerQuest: 1 });
    expect(source.tracks).toEqual([
      { id: 'rh', role: 'rh', hand: 'R', notes: [{ pitch: 'E4', durationTicks: 1920 }] },
      {
        id: 'lh',
        role: 'lh',
        hand: 'L',
        notes: [
          { pitch: 'C3', durationTicks: 480 },
          { pitch: 'G3', durationTicks: 480, chord: true },
        ],
      },
    ]);

    const arrangement = buildArrangementFromSource(source);
    const lh = arrangement.tracks.find((t) => t.id === 'lh')!;
    expect(lh.notes[0]!.startTick).toBe(0);
    expect(lh.notes[1]!.startTick).toBe(0); // chord note shares the base note's onset
    expect(lh.notes[0]!.groupId).toBe(lh.notes[1]!.groupId);
  });

  it('merges a tied note into the previous note\'s duration instead of emitting a second onset', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff><tie type="start"/></note>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>12</duration><voice>1</voice><staff>1</staff><tie type="stop"/></note>
    </measure>`);
    const source = parseMusicXml(xml, { id: 'tied', barsPerQuest: 1 });
    expect(source.tracks[0]!.notes).toEqual([{ pitch: 'C4', durationTicks: 1920 }]);
  });

  it('throws when a tie stop does not follow a matching same-pitch note', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff><tie type="stop"/></note>
    </measure>`);
    expect(() => parseMusicXml(xml, { id: 'bad-tie' })).toThrow(/doesn't follow a matching/);
  });

  it('resolves sharps and flats via <alter>', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>F</step><alter>1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>B</step><alter>-1</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
    </measure>`);
    const source = parseMusicXml(xml, { id: 'accidentals' });
    expect(source.tracks[0]!.notes.map((n) => n.pitch)).toEqual(['F#4', 'Bb4']);
  });

  it('throws on more than one <part> (duet import is out of scope)', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
    </measure>`, { parts: 2 });
    expect(() => parseMusicXml(xml, { id: 'duet' })).toThrow(/multi-part/);
  });

  it('throws when a staff carries more than one voice', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>4</duration><voice>2</voice><staff>1</staff></note>
    </measure>`);
    expect(() => parseMusicXml(xml, { id: 'two-voices' })).toThrow(/more than one voice/);
  });

  it('throws on a grace note', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><grace/><pitch><step>C</step><octave>4</octave></pitch><voice>1</voice><staff>1</staff></note>
    </measure>`);
    expect(() => parseMusicXml(xml, { id: 'grace' })).toThrow(/grace notes/);
  });

  it('throws on a double sharp/flat', () => {
    const xml = score(`<measure number="1">${ATTRS}
      <note><pitch><step>F</step><alter>2</alter><octave>4</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
    </measure>`);
    expect(() => parseMusicXml(xml, { id: 'double-sharp' })).toThrow(/unsupported <alter>/);
  });
});
