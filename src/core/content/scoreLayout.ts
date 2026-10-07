// FR-STU-016 / TA-REN-003 — where every note of a piece sits on a left-to-right grand staff.
// Pure geometry: ticks to x, pitch to a staff line, no drawing. Spacing follows time (a quarter
// note is always the same width), so the score moves at the speed the music does. No key
// signature is drawn; every sharp or flat is written beside its note instead.

import type { Arrangement } from './types';
import { ticksPerMeasure } from './toMusicXml';

export const QUARTER_WIDTH_PX = 64;
export const LEFT_PAD_PX = 70;
const PPQ = 480;

const SHARP_LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const SHARP_ACC = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const FLAT_LETTER = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6];
const FLAT_ACC = [0, -1, 0, -1, 0, 0, -1, 0, -1, 0, -1, 0];

export type StaffName = 'treble' | 'bass';

export interface PlacedNote {
  id: string;
  trackId: string;
  startTick: number;
  x: number;
  staff: StaffName;
  /** Diatonic steps from C-1 (a line or space each half-step of the staff). Treble bottom line is 30, bass 18. */
  step: number;
  accidental: 'sharp' | 'flat' | undefined;
  isHollow: boolean;
  hasStem: boolean;
  /** Shift sideways so a neighbouring second does not overprint. */
  isShifted: boolean;
}

export interface ScoreLayout {
  widthPx: number;
  notes: PlacedNote[];
  bars: { x: number; number: number }[];
  /** Sorted start ticks of the groups of the played track, indexed like MatcherState.groupIndex. */
  groupTicks: number[];
  xOfTick(tick: number): number;
}

export const TREBLE_BOTTOM_STEP = 30; // E4
export const BASS_BOTTOM_STEP = 18; // G2

export function pitchToStep(pitch: number, preferSharps: boolean): { step: number; accidental: 'sharp' | 'flat' | undefined } {
  const pc = pitch % 12;
  const letter = (preferSharps ? SHARP_LETTER : FLAT_LETTER)[pc] ?? 0;
  const acc = (preferSharps ? SHARP_ACC : FLAT_ACC)[pc] ?? 0;
  return { step: (Math.floor(pitch / 12) - 1) * 7 + letter, accidental: acc === 1 ? 'sharp' : acc === -1 ? 'flat' : undefined };
}

export function layoutScore(arrangement: Arrangement, playedTrackId: string, preferSharps: boolean): ScoreLayout {
  const xOfTick = (tick: number): number => LEFT_PAD_PX + (tick * QUARTER_WIDTH_PX) / PPQ;
  const notes: PlacedNote[] = [];
  let lastTick = 0;
  for (const track of arrangement.tracks) {
    for (const note of track.notes) {
      const pitch = note.pitch as number;
      const start = note.startTick as number;
      const duration = note.durationTicks as number;
      const { step, accidental } = pitchToStep(pitch, preferSharps);
      lastTick = Math.max(lastTick, start + duration);
      notes.push({
        id: `${track.id}:${note.id}`,
        trackId: track.id,
        startTick: start,
        x: xOfTick(start),
        staff: pitch >= 60 ? 'treble' : 'bass',
        step,
        accidental,
        isHollow: duration >= PPQ * 2 - PPQ / 8,
        hasStem: duration < PPQ * 4 - PPQ / 8,
        isShifted: false,
      });
    }
  }
  // Notes a step apart on one staff at one moment: the upper one goes to the right of the stem.
  const byMoment = new Map<string, PlacedNote[]>();
  for (const n of notes) {
    const key = `${n.startTick}:${n.staff}`;
    const list = byMoment.get(key);
    if (list) list.push(n);
    else byMoment.set(key, [n]);
  }
  for (const list of byMoment.values()) {
    list.sort((a, b) => a.step - b.step);
    for (let i = 1; i < list.length; i += 1) {
      const previous = list[i - 1];
      const current = list[i];
      if (previous && current && current.step - previous.step === 1 && !previous.isShifted) current.isShifted = true;
    }
  }
  const perMeasure = Math.max(1, ticksPerMeasure(arrangement.timeSig));
  const bars: ScoreLayout['bars'] = [];
  for (let tick = 0, n = 1; tick <= lastTick + perMeasure; tick += perMeasure, n += 1) bars.push({ x: xOfTick(tick), number: n });
  const played = arrangement.tracks.find((t) => t.id === playedTrackId) ?? arrangement.tracks[0];
  const firstTickOfGroup = new Map<string, number>();
  for (const n of played?.notes ?? []) {
    const start = n.startTick as number;
    firstTickOfGroup.set(n.groupId, Math.min(start, firstTickOfGroup.get(n.groupId) ?? start));
  }
  const groupTicks = [...firstTickOfGroup.values()].sort((a, b) => a - b);
  return { widthPx: xOfTick(lastTick) + 160, notes, bars, groupTicks, xOfTick };
}
