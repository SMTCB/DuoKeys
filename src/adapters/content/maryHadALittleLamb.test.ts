import { describe, expect, it } from 'vitest';
import { MARY_HAD_A_LITTLE_LAMB, MARY_HAD_A_LITTLE_LAMB_PIECE } from './maryHadALittleLamb';
import { assertLicenced, type LicenceEntry } from '../../core/content/licence';
import licences from '../../../content/licences.json';

describe('Mary Had a Little Lamb (US-1.13)', () => {
  it('spans exactly eight 4/4 bars', () => {
    const notes = MARY_HAD_A_LITTLE_LAMB.tracks[0]?.notes ?? [];
    const last = notes[notes.length - 1];
    expect(last).toBeDefined();
    const endTick = (last!.startTick as number) + (last!.durationTicks as number);
    expect(endTick).toBe(8 * 4 * 480); // 8 bars * 4 beats * 480 PPQ
  });

  it('assigns every note its own chord group (a monophonic melody)', () => {
    const notes = MARY_HAD_A_LITTLE_LAMB.tracks[0]?.notes ?? [];
    const groupIds = new Set(notes.map((n) => n.groupId));
    expect(groupIds.size).toBe(notes.length);
  });

  it('resolves a licence entry (TA-CNT-005)', () => {
    const entry = assertLicenced(MARY_HAD_A_LITTLE_LAMB_PIECE.licenceId, licences as LicenceEntry[]);
    expect(entry.status).toBe('public-domain');
  });

  it('partitions its quest sections contiguously with no gaps or overlaps (TS-U-CNT-017)', () => {
    const questSections = MARY_HAD_A_LITTLE_LAMB.sections
      .filter((s) => s.kind === 'quest')
      .slice()
      .sort((a, b) => (a.startTick as number) - (b.startTick as number));
    expect(questSections).toHaveLength(4);
    expect(questSections[0]?.startTick).toBe(0);
    for (let i = 1; i < questSections.length; i++) {
      expect(questSections[i]?.startTick).toBe(questSections[i - 1]?.endTick);
    }
    const last = questSections[questSections.length - 1];
    expect(last?.endTick).toBe(8 * 4 * 480);
  });

  it('has exactly one reward section spanning the whole piece (TS-U-CNT-017)', () => {
    const rewardSections = MARY_HAD_A_LITTLE_LAMB.sections.filter((s) => s.kind === 'reward');
    expect(rewardSections).toHaveLength(1);
    expect(rewardSections[0]?.startTick).toBe(0);
    expect(rewardSections[0]?.endTick).toBe(8 * 4 * 480);
    expect(rewardSections[0]?.barRange).toEqual([1, 8]);
  });
});
