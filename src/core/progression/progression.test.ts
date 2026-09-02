import { describe, expect, it } from 'vitest';
import { computeProgression } from './progression';
import { asTicks } from '../time/types';
import type { Section } from '../content/types';
import type { Attempt } from '../data/attempt';
import type { Grade, NoteResult } from '../grade/grade';
import type { Stars } from '../grade/stars';

const SECTIONS: Section[] = [
  { id: 'bars-1-2', label: 'Bars 1–2', startTick: asTicks(0), endTick: asTicks(3840), barRange: [1, 2], kind: 'quest' },
  { id: 'bars-3-4', label: 'Bars 3–4', startTick: asTicks(3840), endTick: asTicks(7680), barRange: [3, 4], kind: 'quest' },
  { id: 'bars-5-6', label: 'Bars 5–6', startTick: asTicks(7680), endTick: asTicks(11520), barRange: [5, 6], kind: 'quest' },
  { id: 'bars-7-8', label: 'Bars 7–8', startTick: asTicks(11520), endTick: asTicks(15360), barRange: [7, 8], kind: 'quest' },
  { id: 'whole-piece', label: 'Mary Had a Little Lamb', startTick: asTicks(0), endTick: asTicks(15360), barRange: [1, 8], kind: 'reward' },
];

function grade(stars: Stars): Grade {
  const perNote: NoteResult[] = [];
  return { accuracy: stars > 0 ? 1 : 0, completion: 1, rushDragMs: 0, timingRmsMs: 0, stars, perNote };
}

function attempt(id: string, arrangementId: string, sectionId: string, stars: Stars): Attempt {
  return {
    id,
    profileId: 'p1',
    arrangementId,
    sectionId,
    startedAt: '2026-09-02T00:00:00.000Z',
    durationMs: 1000,
    mode: 'wait',
    tempoScale: 1,
    grade: grade(stars),
    events: [],
    appVersion: 'test',
  };
}

describe('computeProgression (TS-U-PRO-001…005)', () => {
  it('unlocks only the first quest section when there are no attempts', () => {
    const progress = computeProgression(SECTIONS, []);
    const byId = Object.fromEntries(progress.map((p) => [p.sectionId, p]));
    expect(byId['bars-1-2']?.unlocked).toBe(true);
    expect(byId['bars-3-4']?.unlocked).toBe(false);
    expect(byId['bars-5-6']?.unlocked).toBe(false);
    expect(byId['bars-7-8']?.unlocked).toBe(false);
    expect(byId['whole-piece']?.unlocked).toBe(false);
  });

  it('unlocks the next quest section once the previous one has a ≥1-star attempt', () => {
    const attempts = [attempt('a1', 'mary-d1', 'bars-1-2', 1)];
    const progress = computeProgression(SECTIONS, attempts);
    const byId = Object.fromEntries(progress.map((p) => [p.sectionId, p]));
    expect(byId['bars-3-4']?.unlocked).toBe(true);
    expect(byId['bars-5-6']?.unlocked).toBe(false);
  });

  it('unlocks the reward section only once every quest section is cleared', () => {
    const almost = [
      attempt('a1', 'mary-d1', 'bars-1-2', 2),
      attempt('a2', 'mary-d1', 'bars-3-4', 1),
      attempt('a3', 'mary-d1', 'bars-5-6', 3),
    ];
    expect(computeProgression(SECTIONS, almost).find((p) => p.sectionId === 'whole-piece')?.unlocked).toBe(false);

    const allCleared = [...almost, attempt('a4', 'mary-d1', 'bars-7-8', 1)];
    expect(computeProgression(SECTIONS, allCleared).find((p) => p.sectionId === 'whole-piece')?.unlocked).toBe(true);
  });

  it('takes the best-of-multiple-attempts stars for a section', () => {
    const attempts = [
      attempt('a1', 'mary-d1', 'bars-1-2', 1),
      attempt('a2', 'mary-d1', 'bars-1-2', 3),
      attempt('a3', 'mary-d1', 'bars-1-2', 2),
    ];
    const progress = computeProgression(SECTIONS, attempts);
    expect(progress.find((p) => p.sectionId === 'bars-1-2')?.bestStars).toBe(3);
  });

  it('does not let attempts for a different section leak into unlock state', () => {
    const attempts = [attempt('a1', 'mary-d1', 'whole-piece', 3)];
    const progress = computeProgression(SECTIONS, attempts);
    const byId = Object.fromEntries(progress.map((p) => [p.sectionId, p]));
    expect(byId['bars-3-4']?.unlocked).toBe(false);
    expect(byId['whole-piece']?.unlocked).toBe(false);
    expect(byId['whole-piece']?.bestStars).toBe(3);
  });
});
