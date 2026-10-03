// FR-STU-016 — the adult's song library: search the bundled index, "add to my library".
// Saved ids live on the profile's settings record (TA-DAT-003), like userProgressions, so
// they sync with no new table; the MIDI itself stays a static asset fetched on play.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import { loadSongIndex } from '../../adapters/content/staticSongs';
import type { SongEntry } from '../../core/content/songLibrary';
import { useSessionStore } from './sessionStore';

interface SongLibraryState {
  songs: SongEntry[] | undefined;
  loadError: string | undefined;
  /** Ids the profile has added, in the order added. */
  savedSongIds: string[];
  load(): Promise<void>;
  addSong(id: string): Promise<void>;
  removeSong(id: string): Promise<void>;
}

/** Pure: the saved ids on a settings record, ignoring anything that is not a string. */
export function savedSongIdsOf(settings: unknown): string[] {
  const raw = (settings as { savedSongIds?: unknown } | undefined)?.savedSongIds;
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

async function save(profileId: string, savedSongIds: string[]): Promise<void> {
  const { storage } = getAdapters();
  const existing = await storage.get<Record<string, unknown>>('settings', profileId);
  await storage.put('settings', { ...existing, profileId, updatedAtMs: Date.now(), savedSongIds });
}

export const useSongLibraryStore = create<SongLibraryState>((set, get) => ({
  songs: undefined,
  loadError: undefined,
  savedSongIds: [],

  async load() {
    const settings = await getAdapters().storage.get('settings', useSessionStore.getState().profile.id);
    set({ savedSongIds: savedSongIdsOf(settings) });
    if (get().songs) return;
    try {
      set({ songs: (await loadSongIndex()).songs, loadError: undefined });
    } catch (e) {
      set({ loadError: e instanceof Error ? e.message : String(e) });
    }
  },

  async addSong(id) {
    if (get().savedSongIds.includes(id)) return;
    const savedSongIds = [...get().savedSongIds, id];
    await save(useSessionStore.getState().profile.id, savedSongIds);
    set({ savedSongIds });
  },

  async removeSong(id) {
    const savedSongIds = get().savedSongIds.filter((x) => x !== id);
    await save(useSessionStore.getState().profile.id, savedSongIds);
    set({ savedSongIds });
  },
}));
