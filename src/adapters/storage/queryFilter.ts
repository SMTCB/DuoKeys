// TA-DAT-003 — shared range filter for StorageBackend.query, used by both
// FakeStorageBackend and IdbBackend so the two behave identically. `index`
// may name a compound index ("profileId+startedAt"); the range is applied to
// its first field, which is what every Sprint 1 query actually needs.

import type { KeyRange } from '../ports';

export function matchesRange(value: unknown, index: string, range: KeyRange): boolean {
  const field = index.split('+')[0] ?? index;
  const raw = (value as Record<string, unknown>)[field];
  if (raw === undefined) return false;
  const val = raw as string | number;
  if (range.lower !== undefined && val < (range.lower as string | number)) return false;
  if (range.upper !== undefined && val > (range.upper as string | number)) return false;
  return true;
}
