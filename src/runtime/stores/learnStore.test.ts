// TS-I-DAT-011 — ticked Learn steps (FR-STU-019) live on the settings record beside its other fields and toggle off again.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import type { Profile } from '../../core/profile/types';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));

import { learnDoneOf, useLearnStore } from './learnStore';
import { useSessionStore } from './sessionStore';

const me = { id: 'p1', displayName: 'Sam', role: 'student', keyboardRange: { low: 21, high: 108 }, latencyOffsetMs: 0, toleranceScale: 1, avatar: 'piano' } as Profile;

describe('learn ticks', () => {
  let storage: FakeStorageBackend;

  beforeEach(() => {
    storage = new FakeStorageBackend();
    fakes.adapters = { storage, midi: new FakeMidiBackend(new FakeClock()), audio: new FakeAudioBackend() };
    useSessionStore.getState().setProfile(me);
    useLearnStore.setState({ done: [] });
  });

  it('ticks, persists beside other settings, reloads, and unticks', async () => {
    await storage.put('settings', { profileId: 'p1', updatedAtMs: 1, savedSongIds: ['a'] });
    await useLearnStore.getState().toggle('drill:hanon-1');
    const saved = await storage.get<{ savedSongIds?: string[]; learnDone?: string[] }>('settings', 'p1');
    expect(saved?.savedSongIds).toEqual(['a']);
    expect(saved?.learnDone).toEqual(['drill:hanon-1']);

    useLearnStore.setState({ done: [] });
    await useLearnStore.getState().load();
    expect(useLearnStore.getState().done).toEqual(['drill:hanon-1']);

    await useLearnStore.getState().toggle('drill:hanon-1');
    expect(useLearnStore.getState().done).toEqual([]);
  });

  it('ignores a malformed record', () => {
    expect(learnDoneOf({ learnDone: 'nope' })).toEqual([]);
    expect(learnDoneOf({ learnDone: ['x', 3] })).toEqual(['x']);
    expect(learnDoneOf(undefined)).toEqual([]);
  });
});
