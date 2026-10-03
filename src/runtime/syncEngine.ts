// TA-SYN-001/004 — drains the outbox to the SyncBackend and restores a fresh
// device from it. Framework-free so it can be driven by fakes in tests; the
// Zustand wrapper in stores/syncStore.ts only adds UI state and timers.
//
// Contract with practice (ADR-003, TS-I-SYN-009): nothing here is awaited by a
// session. Every public method resolves, never rejects, and a failure only
// means "sync is behind" — it is retried on the next trigger.

import type { Cursor, OutboxOp, StorageBackend, SyncBackend, SyncUser } from '../adapters/ports';
import { EPOCH_CURSOR } from '../adapters/sync/supabaseBackend';
import type { PulledChange } from '../adapters/sync/mapping';

/** Small key/value persistence for the cursor and backfill flag (localStorage in the browser). */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export type SyncOutcome = 'synced' | 'behind' | 'signed-out' | 'offline';

export interface SyncEngineDeps {
  /** The raw, undecorated store. Restored data must not re-enter the outbox. */
  storage: StorageBackend;
  backend: SyncBackend;
  kv: KeyValueStore;
  /** Queues all existing local records (OutboxStorage.enqueueExisting). */
  enqueueExisting: () => Promise<number>;
  isOnline: () => boolean;
}

const BATCH = 100;
const cursorKey = (userId: string) => `duokeys.sync.cursor.${userId}`;
// v2: flashcards joined the synced stores, so devices linked before that re-queue once (idempotent server-side).
const linkedKey = (userId: string) => `duokeys.sync.linked.v2.${userId}`;

export class SyncEngine {
  private running: Promise<SyncOutcome> | undefined;

  constructor(private readonly deps: SyncEngineDeps) {}

  async pendingCount(): Promise<number> {
    return (await this.deps.storage.query<OutboxOp>('outbox', 'seq', {})).length;
  }

  /** One flush at a time; a call made while one is running joins it. */
  sync(): Promise<SyncOutcome> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(): Promise<SyncOutcome> {
    try {
      if (!this.deps.isOnline()) return 'offline';
      const user = await this.deps.backend.currentUser();
      if (!user) return 'signed-out';

      await this.linkDevice(user);
      const pushed = await this.flush();
      if (!pushed) return 'behind';
      await this.restore(user);
      return 'synced';
    } catch {
      return 'behind';
    }
  }

  /** First time this account meets this device: queue what is already here (US-2.03). */
  private async linkDevice(user: SyncUser): Promise<void> {
    if (this.deps.kv.get(linkedKey(user.id)) === '1') return;
    await this.deps.enqueueExisting();
    this.deps.kv.set(linkedKey(user.id), '1');
  }

  /** Returns true once the outbox is empty. A partial push keeps the unsent tail for next time (TS-I-SYN-003). */
  private async flush(): Promise<boolean> {
    for (;;) {
      const all = await this.deps.storage.query<OutboxOp>('outbox', 'seq', {});
      if (all.length === 0) return true;
      const batch = all.sort((a, b) => a.seq - b.seq).slice(0, BATCH);
      const { accepted } = await this.deps.backend.push(batch);
      for (const op of batch.slice(0, accepted)) await this.deps.storage.delete('outbox', String(op.seq));
      if (accepted < batch.length) return false;
    }
  }

  /** Pull everything since the saved cursor and merge it in (US-2.04). */
  private async restore(user: SyncUser): Promise<void> {
    let cursor: Cursor = this.deps.kv.get(cursorKey(user.id)) ?? EPOCH_CURSOR;
    for (;;) {
      const result = await this.deps.backend.pull(cursor);
      for (const change of result.changes as PulledChange[]) await this.apply(change);
      const advanced = result.cursor !== cursor;
      cursor = result.cursor;
      this.deps.kv.set(cursorKey(user.id), cursor);
      if (result.changes.length === 0 || !advanced) return;
    }
  }

  /**
   * Merge one pulled record (TA-SYN-003): attempts are immutable, so only
   * insert; profiles and flashcards have no local updatedAt, so a local copy
   * always wins; library and settings are last-write-wins on updatedAtMs, and a
   * library tombstone removes the local entry only if it is not newer.
   * Pulled data is written to the raw store so it never re-enters the outbox.
   */
  private async apply(change: PulledChange): Promise<void> {
    const { store, value, deleted } = change;
    const { storage } = this.deps;
    switch (store) {
      case 'attempts': {
        const v = value as { id: string };
        if (!(await storage.get('attempts', v.id))) await storage.put('attempts', value);
        return;
      }
      case 'profiles': {
        const v = value as { id: string };
        if (!(await storage.get('profiles', v.id))) await storage.put('profiles', value);
        return;
      }
      case 'library': {
        const v = value as { profileId: string; arrangementId: string; updatedAtMs: number };
        const key = `${v.profileId}+${v.arrangementId}`;
        const local = await storage.get<{ updatedAtMs: number }>('library', key);
        if (deleted) {
          if (local && v.updatedAtMs >= local.updatedAtMs) await storage.delete('library', key);
          return;
        }
        if (!local || v.updatedAtMs > local.updatedAtMs) await storage.put('library', value);
        return;
      }
      case 'flashcards': {
        const v = value as { profileId: string; cardId: string };
        if (!(await storage.get('flashcards', `${v.profileId}+${v.cardId}`))) await storage.put('flashcards', value);
        return;
      }
      case 'settings': {
        const v = value as { profileId: string; updatedAtMs: number };
        const local = await storage.get<{ updatedAtMs?: number }>('settings', v.profileId);
        if (!local || v.updatedAtMs > (local.updatedAtMs ?? 0)) await storage.put('settings', value);
        return;
      }
    }
  }
}
