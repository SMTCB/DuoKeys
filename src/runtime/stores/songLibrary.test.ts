// TS-I-DAT-009 — songs an adult adds to the library survive a reload and live on the settings record.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import type { Profile } from '../../core/profile/types';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));
vi.mock('../../adapters/content/staticSongs', () => ({
  loadSongIndex: () => Promise.resolve({ songs: [{ id: 'mutopia-1', title: 'Prelude' }, { id: 'mutopia-2', title: 'Nocturne' }] }),
}));

import { savedSongIdsOf, useSongLibraryStore } from './songLibraryStore';
import { useSessionStore } from './sessionStore';

const dad = { id: 'p2', displayName: 'Sam', role: 'student', keyboardRange: { low: 21, high: 108 }, latencyOffsetMs: 0, toleranceScale: 1, avatar: 'piano' } as Profile;

describe('song library', () => {
  let storage: FakeStorageBackend;

  beforeEach(() => {
    storage = new FakeStorageBackend();
    fakes.adapters = { storage, midi: new FakeMidiBackend(new FakeClock()), audio: new FakeAudioBackend() };
    useSessionStore.getState().setProfile(dad);
    useSongLibraryStore.setState({ songs: undefined, savedSongIds: [] });
  });

  it('saves added ids beside the other settings, once each', async () => {
    await storage.put('settings', { profileId: 'p2', updatedAtMs: 1, somethingElse: true });
    await useSongLibraryStore.getState().load();
    await useSongLibraryStore.getState().addSong('mutopia-2');
    await useSongLibraryStore.getState().addSong('mutopia-2');
    await useSongLibraryStore.getState().addSong('mutopia-1');
    const saved = await storage.get<{ somethingElse?: boolean; savedSongIds?: string[] }>('settings', 'p2');
    expect(saved?.somethingElse).toBe(true);
    expect(saved?.savedSongIds).toEqual(['mutopia-2', 'mutopia-1']);
  });

  it('brings them back after a reload, and removes them', async () => {
    await useSongLibraryStore.getState().load();
    await useSongLibraryStore.getState().addSong('mutopia-1');
    useSongLibraryStore.setState({ songs: undefined, savedSongIds: [] });
    await useSongLibraryStore.getState().load();
    expect(useSongLibraryStore.getState().savedSongIds).toEqual(['mutopia-1']);
    await useSongLibraryStore.getState().removeSong('mutopia-1');
    expect((await storage.get<{ savedSongIds: string[] }>('settings', 'p2'))?.savedSongIds).toEqual([]);
  });

  it('ignores a malformed settings record', () => {
    expect(savedSongIdsOf(undefined)).toEqual([]);
    expect(savedSongIdsOf({ savedSongIds: ['a', 3, null] })).toEqual(['a']);
  });
});
