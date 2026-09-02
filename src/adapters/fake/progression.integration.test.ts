// TS-I-DAT-004 — progression, derived from attempts (FR-PRO-002), must
// derive the same result whether fed pre-storage attempts directly or
// round-tripped through a StorageBackend first. Lives under adapters/, not
// core/, because it imports FakeStorageBackend and the core ESLint boundary
// (TA-PORT-001) forbids core/** from importing adapters/**.

import { describe, expect, it } from 'vitest';
import { FakeStorageBackend } from './fakeStorageBackend';
import { computeProgression } from '../../core/progression/progression';
import { computeAttempt } from '../../core/data/attempt';
import { asTicks } from '../../core/time/types';
import type { Section } from '../../core/content/types';
import type { Attempt } from '../../core/data/attempt';
import type { Grade } from '../../core/grade/grade';

const SECTIONS: Section[] = [
  { id: 'bars-1-2', label: 'Bars 1–2', startTick: asTicks(0), endTick: asTicks(3840), barRange: [1, 2], kind: 'quest' },
  { id: 'bars-3-4', label: 'Bars 3–4', startTick: asTicks(3840), endTick: asTicks(7680), barRange: [3, 4], kind: 'quest' },
  { id: 'whole-piece', label: 'Mary Had a Little Lamb', startTick: asTicks(0), endTick: asTicks(7680), barRange: [1, 4], kind: 'reward' },
];

function grade(stars: 0 | 1 | 2 | 3): Grade {
  return { accuracy: stars > 0 ? 1 : 0, completion: 1, rushDragMs: 0, timingRmsMs: 0, stars, perNote: [] };
}

describe('progression via FakeStorageBackend round-trip (TS-I-DAT-004)', () => {
  it('derives the same progression whether attempts are read directly or after a put/query round-trip', async () => {
    const preStorageAttempts: Attempt[] = [
      computeAttempt({
        id: 'a1',
        profileId: 'p1',
        arrangementId: 'mary-d1',
        sectionId: 'bars-1-2',
        startedAtIso: '2026-09-02T00:00:00.000Z',
        durationMs: 1000,
        mode: 'wait',
        tempoScale: 1,
        grade: grade(2),
        appVersion: 'test',
      }),
      computeAttempt({
        id: 'a2',
        profileId: 'p1',
        arrangementId: 'mary-d1',
        sectionId: 'bars-3-4',
        startedAtIso: '2026-09-02T00:01:00.000Z',
        durationMs: 1000,
        mode: 'wait',
        tempoScale: 1,
        grade: grade(1),
        appVersion: 'test',
      }),
    ];

    const directResult = computeProgression(SECTIONS, preStorageAttempts);

    const storage = new FakeStorageBackend();
    for (const attempt of preStorageAttempts) {
      await storage.put('attempts', attempt);
    }
    const queried = await storage.query<Attempt>('attempts', 'profileId', { lower: 'p1', upper: 'p1' });
    const roundTrippedResult = computeProgression(SECTIONS, queried);

    expect(roundTrippedResult).toEqual(directResult);
    expect(roundTrippedResult.find((p) => p.sectionId === 'whole-piece')?.unlocked).toBe(true);
  });

  it('does not let a different profile’s attempts leak into a query filtered by profileId', async () => {
    const storage = new FakeStorageBackend();
    await storage.put(
      'attempts',
      computeAttempt({
        id: 'a1',
        profileId: 'other-profile',
        arrangementId: 'mary-d1',
        sectionId: 'bars-1-2',
        startedAtIso: '2026-09-02T00:00:00.000Z',
        durationMs: 1000,
        mode: 'wait',
        tempoScale: 1,
        grade: grade(3),
        appVersion: 'test',
      }),
    );
    const queried = await storage.query<Attempt>('attempts', 'profileId', { lower: 'p1', upper: 'p1' });
    expect(queried).toEqual([]);
    expect(computeProgression(SECTIONS, queried).find((p) => p.sectionId === 'bars-1-2')?.bestStars).toBe(0);
  });
});
