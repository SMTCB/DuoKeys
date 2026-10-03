// TA-SYN-004 — a StorageBackend decorator that appends an outbox op in the
// same transaction as every write to a synced store. No call site changes:
// stores keep calling storage.put/delete, and the queue fills as a side effect.
// Sync reads the queue; nothing here touches the network (ADR-003).

import type { KeyRange, OutboxOp, StorageBackend, StoreName, Tx } from '../ports';
import { keyOf } from './keyOf';
import { isSyncedStore, SYNCED_STORES, type DeleteEnvelope, type PutEnvelope, type SyncedStore } from '../sync/mapping';

/** The first key field of each synced store — matchesRange filters on it, so `{}` returns every row. */
const INDEX_OF: Record<SyncedStore, string> = { profiles: 'id', attempts: 'id', library: 'profileId', settings: 'profileId', flashcards: 'profileId' };

export class OutboxStorage implements StorageBackend {
  private nextSeq: number | undefined;
  private priming: Promise<void> | undefined;

  /**
   * `inner` is the real store. `onEnqueue` fires after an op is queued so a
   * flush can be scheduled; it must not throw or block. `nowMs` is injected so
   * tests are deterministic (ADR-005's spirit, applied outside core).
   */
  constructor(
    private readonly inner: StorageBackend,
    private readonly onEnqueue: () => void = () => {},
    private readonly nowMs: () => number = () => Date.now(),
  ) {}

  /** Seed seq allocation from the highest queued seq, so ordering survives a reload. Idempotent. */
  primeSeq(): Promise<void> {
    this.priming ??= this.inner.query<OutboxOp>('outbox', 'seq', {}).then(
      (queued) => {
        this.nextSeq = queued.reduce((max, op) => Math.max(max, op.seq), 0) + 1;
      },
      (err: unknown) => {
        this.priming = undefined; // let the next write try again
        throw err;
      },
    );
    return this.priming;
  }

  private async allocSeq(): Promise<number> {
    await this.primeSeq();
    return this.reserveSeq();
  }

  private async op(store: StoreName, op: OutboxOp['op'], payload: unknown): Promise<OutboxOp> {
    return { seq: await this.allocSeq(), store, op, payload };
  }

  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.inner.get<T>(store, key);
  }

  query<T>(store: StoreName, index: string, range: KeyRange): Promise<T[]> {
    return this.inner.query<T>(store, index, range);
  }

  async put<T>(store: StoreName, value: T): Promise<void> {
    if (!isSyncedStore(store)) return this.inner.put(store, value);
    const envelope: PutEnvelope<T> = { value, atMs: this.nowMs() };
    const queued = await this.op(store, 'put', envelope).catch(() => undefined);
    // Sync is additive (ADR-003): if the queue is unusable, the local write still lands.
    if (!queued) return this.inner.put(store, value);
    await this.inner.transaction([store, 'outbox'], async (tx) => {
      await tx.put(store, value);
      await tx.put('outbox', queued);
    });
    this.onEnqueue();
  }

  async delete(store: StoreName, key: string): Promise<void> {
    if (!isSyncedStore(store)) return this.inner.delete(store, key);
    const envelope: DeleteEnvelope = { key, atMs: this.nowMs() };
    const queued = await this.op(store, 'delete', envelope).catch(() => undefined);
    if (!queued) return this.inner.delete(store, key);
    await this.inner.transaction([store, 'outbox'], async (tx) => {
      await tx.delete(store, key);
      await tx.put('outbox', queued);
    });
    this.onEnqueue();
  }

  async transaction<T>(stores: StoreName[], fn: (tx: Tx) => Promise<T>): Promise<T> {
    const touchesSynced = stores.some(isSyncedStore);
    if (!touchesSynced) return this.inner.transaction(stores, fn);

    // Seq allocation is async, so it must finish before the IDB transaction opens.
    try {
      await this.primeSeq();
    } catch {
      return this.inner.transaction(stores, fn);
    }
    const pending: OutboxOp[] = [];
    const result = await this.inner.transaction(stores.includes('outbox') ? stores : [...stores, 'outbox'], async (tx) => {
      const wrapped: Tx = {
        get: (store, key) => tx.get(store, key),
        put: async (store, value) => {
          await tx.put(store, value);
          if (isSyncedStore(store)) {
            const envelope: PutEnvelope = { value, atMs: this.nowMs() };
            pending.push({ seq: this.reserveSeq(), store, op: 'put', payload: envelope });
          }
        },
        delete: async (store, key) => {
          await tx.delete(store, key);
          if (isSyncedStore(store)) {
            const envelope: DeleteEnvelope = { key, atMs: this.nowMs() };
            pending.push({ seq: this.reserveSeq(), store, op: 'delete', payload: envelope });
          }
        },
      };
      const out = await fn(wrapped);
      for (const queued of pending) await tx.put('outbox', queued);
      return out;
    });
    if (pending.length > 0) this.onEnqueue();
    return result;
  }

  private reserveSeq(): number {
    if (this.nextSeq === undefined) {
      throw new Error('OutboxStorage: seq used before primeSeq() resolved');
    }
    return this.nextSeq++;
  }

  /** Queue every existing local record — used once when an account is first linked on a device that already holds data. Upserts are idempotent server-side (TS-I-SYN-006). */
  async enqueueExisting(): Promise<number> {
    let count = 0;
    // Skip records the outbox already holds a put for, so linking an account does not double-queue them.
    const alreadyQueued = new Set(
      (await this.inner.query<OutboxOp>('outbox', 'seq', {}))
        .filter((op) => op.op === 'put' && isSyncedStore(op.store))
        .map((op) => `${op.store}|${keyOf(op.store, (op.payload as PutEnvelope).value)}`),
    );
    for (const store of SYNCED_STORES) {
      const rows = await this.inner.query<unknown>(store, INDEX_OF[store], {});
      for (const value of rows) {
        if (alreadyQueued.has(`${store}|${keyOf(store, value)}`)) continue;
        const queued = await this.op(store, 'put', { value, atMs: this.nowMs() } satisfies PutEnvelope);
        await this.inner.put('outbox', queued);
        count += 1;
      }
    }
    if (count > 0) this.onEnqueue();
    return count;
  }
}
