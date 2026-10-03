// Runtime library state (Zustand, TA-APP-001), US-3.15. Owns the active
// profile's saved/in-progress repertoire (TA-DAT-007) — an adult explicitly
// adds a piece here, so add/remove is an idempotent put/delete against the
// `library` store, distinct from progression's derived unlock/best-grade state.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import type { LibraryEntry, LibraryStatus } from '../../core/data/library';
import { asMillis } from '../../core/time/types';

interface LibraryState {
  /** This profile's entries, keyed by arrangementId. */
  entries: Map<string, LibraryEntry>;
  loaded: boolean;

  loadLibrary(profileId: string): Promise<void>;
  setStatus(profileId: string, arrangementId: string, status: LibraryStatus): Promise<void>;
  clearStatus(profileId: string, arrangementId: string): Promise<void>;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  entries: new Map(),
  loaded: false,

  async loadLibrary(profileId: string): Promise<void> {
    const rows = await getAdapters().storage.query<LibraryEntry>('library', 'profileId', {
      lower: profileId,
      upper: profileId,
    });
    set({ entries: new Map(rows.map((r) => [r.arrangementId, r])), loaded: true });
  },

  async setStatus(profileId: string, arrangementId: string, status: LibraryStatus): Promise<void> {
    const nowMs = asMillis(Date.now());
    const existing = get().entries.get(arrangementId);
    const entry: LibraryEntry = {
      profileId,
      arrangementId,
      status,
      addedAtMs: existing?.addedAtMs ?? nowMs,
      updatedAtMs: nowMs,
    };
    await getAdapters().storage.put('library', entry);
    set({ entries: new Map(get().entries).set(arrangementId, entry) });
  },

  async clearStatus(profileId: string, arrangementId: string): Promise<void> {
    await getAdapters().storage.delete('library', `${profileId}+${arrangementId}`);
    const next = new Map(get().entries);
    next.delete(arrangementId);
    set({ entries: next });
  },
}));
