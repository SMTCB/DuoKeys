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

const ACTIVE_PROFILE_KEY = 'duokeys.activeProfileId';

// The chosen profile survives a reload, so a page opened directly (a bookmark,
// a refresh) still sees that person's songs and settings. A per-device
// convenience only: it is never synced, and storage failures are ignored.
function rememberActive(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_PROFILE_KEY, id);
  } catch {
    /* private window or blocked storage: the picker still works */
  }
}

function recalledActive(): string | undefined {
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

interface ProfileState {
  profiles: Profile[];
  loaded: boolean;

  loadProfiles(): Promise<void>;
  addProfile(displayName: string, role: Profile['role'], avatar: string): Promise<Profile>;
  selectProfile(id: string): void;
  /** Re-activates the profile chosen before a reload, if it still exists. */
  restoreActiveProfile(): Promise<void>;
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
    rememberActive(profile.id);
    return profile;
  },

  selectProfile(id: string): void {
    const profile = get().profiles.find((p) => p.id === id);
    if (!profile) return;
    useSessionStore.getState().setProfile(profile);
    rememberActive(id);
  },

  async restoreActiveProfile(): Promise<void> {
    const id = recalledActive();
    if (!id) return;
    if (!get().loaded) await get().loadProfiles();
    get().selectProfile(id);
  },
}));
