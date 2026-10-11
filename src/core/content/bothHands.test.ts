import { describe, expect, it } from 'vitest';
import { withBothHands } from './bothHands';
import { buildArrangementFromSource } from './buildArrangement';

const source = {
  id: 's',
  title: 'T',
  tempoBpm: 100,
  timeSig: [4, 4] as [number, number],
  keySig: 'C',
  tracks: [
    { id: 'rh', role: 'rh' as const, hand: 'R' as const, notes: [{ pitch: 'C5', durationTicks: 3840 }] },
    { id: 'lh', role: 'lh' as const, hand: 'L' as const, notes: [{ pitch: 'C3', durationTicks: 3840 }] },
  ],
};

describe('withBothHands', () => {
  it('adds a both track whose simultaneous notes share one group', () => {
    const a = withBothHands(buildArrangementFromSource(source as never));
    const both = a.tracks.find((t) => t.id === 'both');
    expect(both?.notes).toHaveLength(2);
    expect(new Set(both?.notes.map((n) => n.groupId)).size).toBe(1);
    expect(both?.notes.map((n) => n.hand)).toEqual(['L', 'R']);
  });

  it('leaves a single-track piece alone and does not add a second both track', () => {
    const one = buildArrangementFromSource({ ...source, tracks: [source.tracks[0]!] } as never);
    expect(withBothHands(one)).toBe(one);
    const a = withBothHands(buildArrangementFromSource(source as never));
    expect(withBothHands(a)).toBe(a);
  });
});
