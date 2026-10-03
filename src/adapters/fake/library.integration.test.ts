// TS-I-DAT-007 — library entries (US-3.15, TA-DAT-007) round-trip through a
// StorageBackend keyed profileId+arrangementId, so a status change is an
// idempotent put — not an append — and a delete actually removes the row.
// Lives under adapters/, not core/, because it imports FakeStorageBackend and
// the core ESLint boundary (TA-PORT-001) forbids core/** from importing
// adapters/**.

import { describe, expect, it } from 'vitest';
import { FakeStorageBackend } from './fakeStorageBackend';
import { asMillis } from '../../core/time/types';
import type { LibraryEntry } from '../../core/data/library';

function entry(status: LibraryEntry['status'], updatedAtMs: number): LibraryEntry {
  return {
    profileId: 'p1',
    arrangementId: 'mary-d1',
    status,
    addedAtMs: asMillis(0),
    updatedAtMs: asMillis(updatedAtMs),
  };
}

describe('library entries via FakeStorageBackend round-trip (TS-I-DAT-007)', () => {
  it('a status change overwrites the same row rather than appending a new one', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('library', entry('wantToLearn', 1000));
    await storage.put('library', entry('learning', 2000));

    const rows = await storage.query<LibraryEntry>('library', 'profileId', { lower: 'p1', upper: 'p1' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('learning');
  });

  it('deleting the profileId+arrangementId key removes the entry entirely', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('library', entry('learned', 1000));
    await storage.delete('library', 'p1+mary-d1');

    const rows = await storage.query<LibraryEntry>('library', 'profileId', { lower: 'p1', upper: 'p1' });
    expect(rows).toEqual([]);
  });

  it('does not let a different profile’s library entries leak into a query filtered by profileId', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('library', { ...entry('learning', 1000), profileId: 'other-profile' });

    const rows = await storage.query<LibraryEntry>('library', 'profileId', { lower: 'p1', upper: 'p1' });
    expect(rows).toEqual([]);
  });
});
