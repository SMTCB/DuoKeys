// TA-DAT-007 — saved / in-progress repertoire (US-3.15, FR-PRO-006). Persisted
// in the `library` IndexedDB store (TA-DAT-003), keyed `profileId+arrangementId`.

import type { Millis } from '../time/types';

export type LibraryStatus = 'wantToLearn' | 'learning' | 'learned';

export interface LibraryEntry {
  profileId: string;
  arrangementId: string;
  status: LibraryStatus;
  addedAtMs: Millis;
  updatedAtMs: Millis;
}
