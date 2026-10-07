// TS-U-CNT-052 — the left-to-right score layout: spacing follows time, pitches land on the right lines.
import { describe, expect, it } from 'vitest';
import { layoutScore, pitchToStep, QUARTER_WIDTH_PX } from './scoreLayout';
import type { Arrangement } from './types';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';

const note = (id: string, pitch: number, start: number, groupId: string, duration = 480) => ({
  id,
  pitch: asMidiPitch(pitch),
  startTick: asTicks(start),
  durationTicks: asTicks(duration),
  groupId,
  trackId: 'rh',
});

const arrangement = {
  id: 'a',
  pieceId: 'p',
  difficulty: 1,
  tempoMap: [] as never,
  timeSig: [4, 4],
  keySig: 'C',
  tracks: [
    { id: 'rh', role: 'rh', hand: 'R', notes: [note('a', 64, 0, 'g0'), note('b', 67, 0, 'g0'), note('c', 65, 480, 'g1'), note('d', 66, 960, 'g2', 1920)] },
    { id: 'lh', role: 'lh', hand: 'L', notes: [note('e', 48, 0, 'g0', 1920)] },
  ],
  sections: [],
  analysis: {} as never,
} as unknown as Arrangement;

describe('scoreLayout (TS-U-CNT-052)', () => {
  it('puts E4 on the treble bottom line and G2 on the bass bottom line', () => {
    expect(pitchToStep(64, true).step).toBe(30);
    expect(pitchToStep(43, true).step).toBe(18);
  });
  it('spells a black key with a sharp or a flat as asked', () => {
    expect(pitchToStep(61, true)).toEqual({ step: 28, accidental: 'sharp' });
    expect(pitchToStep(61, false)).toEqual({ step: 29, accidental: 'flat' });
  });
  it('spaces notes by time and splits the hands at middle C', () => {
    const layout = layoutScore(arrangement, 'rh', true);
    const byId = new Map(layout.notes.map((n) => [n.id, n]));
    expect(byId.get('rh:c')!.x - byId.get('rh:a')!.x).toBe(QUARTER_WIDTH_PX);
    expect(byId.get('rh:a')!.staff).toBe('treble');
    expect(byId.get('lh:e')!.staff).toBe('bass');
    expect(byId.get('rh:d')!.isHollow).toBe(true);
    expect(byId.get('rh:c')!.isHollow).toBe(false);
  });
  it('lists the played track\'s chords in order, for the matcher\'s group index', () => {
    expect(layoutScore(arrangement, 'rh', true).groupTicks).toEqual([0, 480, 960]);
  });
});
