// TA-DAT-003 — key derivation shared by FakeStorageBackend and IdbBackend so
// a fixture written through the fake reads back exactly as IdbBackend would
// produce it (TA-PORT-004's whole premise: fakes must behave like the real thing).

import type { StoreName } from '../ports';

export function keyOf(store: StoreName, value: unknown): string {
  const v = value as Record<string, unknown>;
  switch (store) {
    case 'progression':
      return `${String(v.profileId)}+${String(v.arrangementId)}`;
    case 'flashcards':
      return `${String(v.profileId)}+${String(v.cardId)}`;
    case 'settings':
      return String(v.profileId);
    case 'outbox':
      return String(v.seq);
    default:
      return String(v.id);
  }
}
