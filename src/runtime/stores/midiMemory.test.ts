// TS-I-MID-002 — the chosen MIDI input is remembered on the profile and offered first next time.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import type { Profile } from '../../core/profile/types';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));

import { rememberMidiInput, useSessionStore } from './sessionStore';

const mia: Profile = {
  id: 'p1',
  displayName: 'Mia',
  role: 'explorer',
  keyboardRange: { low: 21, high: 108 },
  latencyOffsetMs: 0,
  toleranceScale: 1,
  avatar: 'piano',
} as Profile;

describe('remembered MIDI input', () => {
  let storage: FakeStorageBackend;

  beforeEach(() => {
    const clock = new FakeClock();
    storage = new FakeStorageBackend();
    fakes.adapters = { storage, midi: new FakeMidiBackend(clock), audio: new FakeAudioBackend() };
  });

  it('selecting an input writes it to the stored profile and the active one', async () => {
    await storage.put('profiles', mia);
    useSessionStore.getState().setProfile(mia);
    await useSessionStore.getState().selectMidiInput('fake-piano');
    expect((await storage.get<Profile>('profiles', 'p1'))?.midiInputId).toBe('fake-piano');
    expect(useSessionStore.getState().profile.midiInputId).toBe('fake-piano');
  });

  it('does not create a profile record for an unsaved (default) profile', async () => {
    useSessionStore.getState().setProfile(mia); // never stored
    await rememberMidiInput('fake-piano');
    expect(await storage.get('profiles', 'p1')).toBeUndefined();
  });

  it('lists the remembered input first after a reload', async () => {
    useSessionStore.getState().setProfile({ ...mia, midiInputId: 'fake-piano' });
    await useSessionStore.getState().refreshMidiInputs();
    expect(useSessionStore.getState().midiInputs[0]?.id).toBe('fake-piano');
  });
});
