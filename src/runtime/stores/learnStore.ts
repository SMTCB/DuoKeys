// FR-STU-019 — which Learn steps the adult has ticked off. Stored on the profile's settings
// record (TA-DAT-003) as `learnDone`, so it syncs with no table of its own. A tick is a
// private note to self: nothing counts days, nothing expires, and unticking is one tap.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import { useSessionStore } from './sessionStore';

interface LearnState {
  done: string[];
  load(): Promise<void>;
  toggle(stepId: string): Promise<void>;
}

/** Reads the ticked step ids off a settings record, ignoring anything malformed. */
export function learnDoneOf(settings: unknown): string[] {
  const raw = (settings as { learnDone?: unknown } | undefined)?.learnDone;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

export const useLearnStore = create<LearnState>((set, get) => ({
  done: [],

  async load() {
    const settings = await getAdapters().storage.get('settings', useSessionStore.getState().profile.id);
    set({ done: learnDoneOf(settings) });
  },

  async toggle(stepId) {
    const profileId = useSessionStore.getState().profile.id;
    const done = get().done.includes(stepId) ? get().done.filter((d) => d !== stepId) : [...get().done, stepId];
    const { storage } = getAdapters();
    const existing = await storage.get<Record<string, unknown>>('settings', profileId);
    await storage.put('settings', { ...existing, profileId, updatedAtMs: Date.now(), learnDone: done });
    set({ done });
  },
}));
