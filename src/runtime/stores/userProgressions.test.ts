// TS-I-CHD-001 — an adult's own progressions survive a reload, live on the profile's settings record, and join the catalogue.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import type { Profile } from '../../core/profile/types';
import { asPitchClass } from '../../core/content/chordTypes';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));
vi.mock('../../adapters/content/staticChords', () => ({
  loadChordCatalogue: () =>
    Promise.resolve({
      chords: [{ id: 'C-maj', root: 0, quality: 'maj', midiNotes: [60, 64, 67] }],
      progressions: [{ id: 'C-I-V', name: 'I-V', key: 0, mode: 'major', moods: [], chordIds: ['C-maj'], suggestedBpm: 90 }],
    }),
}));

import { useChordExplorerStore } from './chordExplorerStore';
import { useSessionStore } from './sessionStore';

const dad = { id: 'p2', displayName: 'Sam', role: 'student', keyboardRange: { low: 21, high: 108 }, latencyOffsetMs: 0, toleranceScale: 1, avatar: 'piano' } as Profile;
const input = { name: '', text: 'Am F C G', key: asPitchClass(0), mode: 'major' as const };

describe('user progressions', () => {
  let storage: FakeStorageBackend;

  beforeEach(() => {
    storage = new FakeStorageBackend();
    fakes.adapters = { storage, midi: new FakeMidiBackend(new FakeClock()), audio: new FakeAudioBackend() };
    useSessionStore.getState().setProfile(dad);
  });

  it('adds a progression to the catalogue and saves it on the settings record', async () => {
    await storage.put('settings', { profileId: 'p2', updatedAtMs: 1, somethingElse: true });
    const store = useChordExplorerStore.getState();
    await store.loadCatalogue();
    expect(await store.addUserProgression(input)).toBeUndefined();

    const { catalogue } = useChordExplorerStore.getState();
    const mine = catalogue?.progressions.filter((p) => p.isUserAdded);
    expect(mine?.[0]?.chordIds).toEqual(['A-min', 'F-maj', 'C-maj', 'G-maj']);
    expect(catalogue?.chords.map((c) => c.id)).toContain('G-maj');

    const saved = await storage.get<{ somethingElse?: boolean; userProgressions?: unknown[] }>('settings', 'p2');
    expect(saved?.somethingElse).toBe(true);
    expect(saved?.userProgressions).toHaveLength(1);
  });

  it('brings them back after a reload, and removes them', async () => {
    await useChordExplorerStore.getState().loadCatalogue();
    await useChordExplorerStore.getState().addUserProgression(input);
    useChordExplorerStore.setState({ catalogue: undefined, userProgressions: [] });

    await useChordExplorerStore.getState().loadCatalogue();
    const [mine] = useChordExplorerStore.getState().userProgressions;
    expect(mine?.name).toBe('Am F C G');

    await useChordExplorerStore.getState().removeUserProgression(mine!.id);
    expect(useChordExplorerStore.getState().catalogue?.progressions.some((p) => p.isUserAdded)).toBe(false);
    expect((await storage.get<{ userProgressions: unknown[] }>('settings', 'p2'))?.userProgressions).toEqual([]);
  });

  it('returns the problem and saves nothing for text it cannot read', async () => {
    await useChordExplorerStore.getState().loadCatalogue();
    const error = await useChordExplorerStore.getState().addUserProgression({ ...input, text: 'C Wibble' });
    expect(error).toContain('Wibble');
    expect(await storage.get('settings', 'p2')).toBeUndefined();
  });
});
