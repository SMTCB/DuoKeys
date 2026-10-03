// TS-U-REN-008..010 — arrangementToMusicXml, tied to TA-REN-003.

import { describe, expect, it } from 'vitest';
import { arrangementToMusicXml } from './toMusicXml';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';
import type { Arrangement, ContentNote, Track } from './types';

function note(pitch: number, startTick: number, durationTicks: number, id = `n${startTick}`): ContentNote {
  return {
    id,
    pitch: asMidiPitch(pitch),
    startTick: asTicks(startTick),
    durationTicks: asTicks(durationTicks),
    groupId: id,
    trackId: 'melody',
  };
}

function arrangement(notes: ContentNote[], overrides: Partial<Arrangement> = {}): Arrangement {
  const track: Track = { id: 'melody', role: 'melody', hand: 'R', notes };
  return {
    id: 'test-d1',
    pieceId: 'test',
    difficulty: 1,
    tempoMap: [{ atTick: asTicks(0), bpm: 100 }],
    timeSig: [4, 4],
    keySig: 'C',
    tracks: [track],
    sections: [],
    analysis: {
      pitchRange: 0,
      handPositionChanges: 0,
      rhythmicVocabulary: 0,
      handIndependence: 0,
      accidentalDensity: 0,
      overall: 1,
    },
    ...overrides,
  };
}

// TS-U-REN-008 — measure/beat placement from timeSig + PPQ.
describe('arrangementToMusicXml — measure placement', () => {
  it('places notes into successive 4/4 measures once cumulative ticks cross 1920', () => {
    const notes = [
      note(60, 0, 480), note(62, 480, 480), note(64, 960, 480), note(65, 1440, 480), // measure 1 (fills to 1920)
      note(67, 1920, 1920), // measure 2
    ];
    const xml = arrangementToMusicXml(arrangement(notes), 'melody');
    expect(xml.match(/<measure number="1">/g)).toHaveLength(1);
    expect(xml.match(/<measure number="2">/g)).toHaveLength(1);
    expect(xml.match(/<measure number="3">/)).toBeNull();
  });

  it('uses a shorter measure length for 3/4 time', () => {
    const notes = [note(60, 0, 960), note(62, 960, 480), note(64, 1440, 960)]; // 2nd note starts in measure 1, 3rd in measure 2
    const xml = arrangementToMusicXml(arrangement(notes, { timeSig: [3, 4] }), 'melody');
    const measure1 = xml.split('<measure number="1">')[1]!.split('<measure number="2">')[0]!;
    expect(measure1.match(/<note>/g)).toHaveLength(2);
    expect(xml).toContain('<beats>3</beats>');
    expect(xml).toContain('<beat-type>4</beat-type>');
  });
});

// TS-U-REN-009 — durationTicks -> MusicXML note-type mapping.
describe('arrangementToMusicXml — note-type mapping', () => {
  it('maps quarter/half/whole durations to their MusicXML types', () => {
    const notes = [note(60, 0, 480), note(62, 480, 960), note(64, 1440, 1920)];
    const xml = arrangementToMusicXml(arrangement(notes), 'melody');
    expect(xml).toContain('<type>quarter</type>');
    expect(xml).toContain('<type>half</type>');
    expect(xml).toContain('<type>whole</type>');
  });

  it('spells a sharp pitch class with an <alter>1</alter>', () => {
    const xml = arrangementToMusicXml(arrangement([note(61, 0, 480)]), 'melody'); // C#4
    expect(xml).toContain('<step>C</step>');
    expect(xml).toContain('<alter>1</alter>');
  });

  it('throws on a durationTicks with no note-type mapping', () => {
    expect(() => arrangementToMusicXml(arrangement([note(60, 0, 100)]), 'melody')).toThrow(/durationTicks/);
  });
});

// TS-U-REN-010 — documented single-voice/no-rests limitation.
describe('arrangementToMusicXml — single-voice limitation', () => {
  it('emits exactly one <note> per source note, in order, with no rests inserted for gaps', () => {
    // A gap between startTick 0+480=480 and the next note's startTick 960 is a
    // real gap (a rest, musically) — the converter does not synthesize one;
    // it just emits the notes it was given, in order.
    const notes = [note(60, 0, 480), note(62, 960, 480)];
    const xml = arrangementToMusicXml(arrangement(notes), 'melody');
    expect(xml.match(/<note>/g)).toHaveLength(2);
    expect(xml.match(/<rest/)).toBeNull();
  });

  it('throws when the requested track id is not on the arrangement', () => {
    expect(() => arrangementToMusicXml(arrangement([note(60, 0, 480)]), 'nope')).toThrow(/no track/);
  });
});
