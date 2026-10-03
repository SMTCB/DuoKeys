// Runtime profile state (Zustand, TA-APP-001), US-2.01. Owns the family's
// saved profiles and propagates the active one into sessionStore, which is
// already read reactively by every Explorer page (quest map, play, session
// arc). noteNinjaStore is bridged separately, at the Note Ninja route,
// since it keeps its own non-reactive `activeProfile` reference.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import type { Profile } from '../../core/profile/types';
import { createProfile } from '../../core/profile/createProfile';
import { useSessionStore } from './sessionStore';

export const MAX_PROFILES = 4; // FR-PRO-001 — two to four profiles per family device

interface ProfileState {
  profiles: Profile[];
  loaded: boolean;

  loadProfiles(): Promise<void>;
  addProfile(displayName: string, role: Profile['role'], avatar: string): Promise<Profile>;
  selectProfile(id: string): void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  loaded: false,

  async loadProfiles(): Promise<void> {
    const profiles = await getAdapters().storage.query<Profile>('profiles', 'id', {});
    set({ profiles, loaded: true });
  },

  async addProfile(displayName: string, role: Profile['role'], avatar: string): Promise<Profile> {
    const { profiles } = get();
    if (profiles.length >= MAX_PROFILES) {
      throw new Error(`profileStore: a family device holds at most ${MAX_PROFILES} profiles (FR-PRO-001)`);
    }
    const profile = createProfile({ id: crypto.randomUUID(), displayName, role, avatar });
    await getAdapters().storage.put('profiles', profile);
    set({ profiles: [...profiles, profile] });
    useSessionStore.getState().setProfile(profile);
    return profile;
  },

  selectProfile(id: string): void {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    useSessionStore.getState().setProfile(profile);
  },
}));
