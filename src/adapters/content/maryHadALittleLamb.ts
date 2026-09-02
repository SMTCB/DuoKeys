// US-1.13 — one hard-coded eight-bar tune. Hand-authored, not ingested: the
// content pipeline (TA-CNT-001) is explicitly out of scope for Sprint 1
// (docs/03-SPRINT-PLAN.md). Grouping still runs through the real core
// function (TA-MAT-004) rather than being hand-assigned, so the same logic
// content-ingest will use later is already exercised here.

import { asMidiPitch, type MidiPitch } from '../../core/midi/decode';
import { asTicks } from '../../core/time/types';
import { groupNotesByTicks } from '../../core/match/types';
import type { Arrangement, ContentNote, Piece } from '../../core/content/types';

const C = asMidiPitch(60);
const D = asMidiPitch(62);
const E = asMidiPitch(64);
const G = asMidiPitch(67);

const QUARTER = 480;
const HALF = 960;
const WHOLE = 1920;

interface RawNote {
  pitch: MidiPitch;
  durationTicks: number;
}

// Bar-by-bar melody, one hand (five-finger C position: C D E G).
const MELODY: RawNote[] = [
  // Bar 1
  { pitch: E, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  { pitch: C, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  // Bar 2
  { pitch: E, durationTicks: QUARTER },
  { pitch: E, durationTicks: QUARTER },
  { pitch: E, durationTicks: HALF },
  // Bar 3
  { pitch: D, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  { pitch: D, durationTicks: HALF },
  // Bar 4
  { pitch: E, durationTicks: QUARTER },
  { pitch: G, durationTicks: QUARTER },
  { pitch: G, durationTicks: HALF },
  // Bar 5
  { pitch: E, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  { pitch: C, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  // Bar 6
  { pitch: E, durationTicks: QUARTER },
  { pitch: E, durationTicks: QUARTER },
  { pitch: E, durationTicks: QUARTER },
  { pitch: E, durationTicks: QUARTER },
  // Bar 7
  { pitch: D, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  { pitch: E, durationTicks: QUARTER },
  { pitch: D, durationTicks: QUARTER },
  // Bar 8
  { pitch: C, durationTicks: WHOLE },
];

function buildNotes(trackId: string): ContentNote[] {
  let startTick = 0;
  const withTicks = MELODY.map((n, i) => {
    const note = { id: `n${i + 1}`, atTick: asTicks(startTick), pitch: n.pitch, durationTicks: n.durationTicks };
    startTick += n.durationTicks;
    return note;
  });
  const grouped = groupNotesByTicks(withTicks, 30);
  return grouped.map((n) => ({
    id: n.id,
    pitch: n.pitch,
    startTick: n.atTick,
    durationTicks: asTicks(n.durationTicks),
    groupId: n.groupId,
    trackId,
  }));
}

export const MARY_HAD_A_LITTLE_LAMB_PIECE: Piece = {
  id: 'mary-had-a-little-lamb',
  title: 'Mary Had a Little Lamb',
  tags: ['traditional', 'five-finger', 'beginner'],
  licenceId: 'trad-mary-had-a-little-lamb',
};

const TOTAL_TICKS = MELODY.reduce((sum, n) => sum + n.durationTicks, 0);

export const MARY_HAD_A_LITTLE_LAMB: Arrangement = {
  id: 'mary-had-a-little-lamb-d1',
  pieceId: MARY_HAD_A_LITTLE_LAMB_PIECE.id,
  difficulty: 1,
  tempoMap: [{ atTick: asTicks(0), bpm: 100 }],
  timeSig: [4, 4],
  keySig: 'C',
  tracks: [{ id: 'melody', role: 'melody', hand: 'R', notes: buildNotes('melody') }],
  sections: [
    { id: 'bars-1-2', label: 'Bars 1–2', startTick: asTicks(0), endTick: asTicks(3840), barRange: [1, 2], kind: 'quest' },
    { id: 'bars-3-4', label: 'Bars 3–4', startTick: asTicks(3840), endTick: asTicks(7680), barRange: [3, 4], kind: 'quest' },
    { id: 'bars-5-6', label: 'Bars 5–6', startTick: asTicks(7680), endTick: asTicks(11520), barRange: [5, 6], kind: 'quest' },
    { id: 'bars-7-8', label: 'Bars 7–8', startTick: asTicks(11520), endTick: asTicks(15360), barRange: [7, 8], kind: 'quest' },
    {
      id: 'whole-piece',
      label: 'Mary Had a Little Lamb',
      startTick: asTicks(0),
      endTick: asTicks(TOTAL_TICKS),
      barRange: [1, 8],
      kind: 'reward',
    },
  ],
  analysis: {
    pitchRange: 7,
    handPositionChanges: 0,
    rhythmicVocabulary: 2,
    handIndependence: 0,
    accidentalDensity: 0,
    overall: 1,
  },
};
