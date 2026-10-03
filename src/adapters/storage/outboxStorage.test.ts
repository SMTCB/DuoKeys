// TS-I-SYN-001 — a local write appends an outbox op, in the same step as the write.

import { describe, expect, it, vi } from 'vitest';
import { FakeStorageBackend } from '../fake/fakeStorageBackend';
import { OutboxStorage } from './outboxStorage';
import type { OutboxOp } from '../ports';

const queued = (inner: FakeStorageBackend) => inner.query<OutboxOp>('outbox', 'seq', {});

describe('OutboxStorage (TS-I-SYN-001)', () => {
  it('queues a put to a synced store and still writes locally', async () => {
    const inner = new FakeStorageBackend();
    const onEnqueue = vi.fn();
    const storage = new OutboxStorage(inner, onEnqueue, () => 500);
    await storage.put('library', { profileId: 'p1', arrangementId: 'a', status: 'learning', addedAtMs: 1, updatedAtMs: 2 });

    expect(await inner.get('library', 'p1+a')).toBeDefined();
    const ops = await queued(inner);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ seq: 1, store: 'library', op: 'put', payload: { atMs: 500 } });
    expect(onEnqueue).toHaveBeenCalledTimes(1);
  });

  it('queues flashcard writes, which sync as of US-2.03 hardening', async () => {
    const inner = new FakeStorageBackend();
    const storage = new OutboxStorage(inner);
    await storage.put('flashcards', { profileId: 'p1', cardId: 'C4' });
    expect((await queued(inner))[0]).toMatchObject({ store: 'flashcards', op: 'put' });
  });

  it('queues a delete with the store key', async () => {
    const inner = new FakeStorageBackend();
    const storage = new OutboxStorage(inner, undefined, () => 1);
    await storage.delete('library', 'p1+a');
    expect((await queued(inner))[0]).toMatchObject({ op: 'delete', payload: { key: 'p1+a' } });
  });

  it('does not queue stores that never sync (progression is derived)', async () => {
    const inner = new FakeStorageBackend();
    const storage = new OutboxStorage(inner);
    await storage.put('progression', { profileId: 'p1', arrangementId: 'a' });
    expect(await queued(inner)).toEqual([]);
  });

  it('allocates increasing seqs, continuing after ops left from a previous run', async () => {
    const inner = new FakeStorageBackend();
    await inner.put('outbox', { seq: 7, store: 'attempts', op: 'put', payload: {} });
    const storage = new OutboxStorage(inner);
    await storage.put('attempts', { id: 'a1' });
    await storage.put('attempts', { id: 'a2' });
    const seqs = (await queued(inner)).map((o) => o.seq).sort((a, b) => a - b);
    expect(seqs).toEqual([7, 8, 9]);
  });

  it('queues writes made inside a transaction', async () => {
    const inner = new FakeStorageBackend();
    const storage = new OutboxStorage(inner);
    await storage.transaction(['attempts', 'progression'], async (tx) => {
      await tx.put('attempts', { id: 'a1' });
      await tx.put('progression', { profileId: 'p', arrangementId: 'a' });
    });
    const ops = await queued(inner);
    expect(ops.map((o) => o.store)).toEqual(['attempts']);
  });

  it('keeps the local write when the queue itself is unusable (sync is additive)', async () => {
    const inner = new FakeStorageBackend();
    const realQuery = inner.query.bind(inner);
    inner.query = (async (store: Parameters<typeof realQuery>[0], index: string, range: Parameters<typeof realQuery>[2]) => {
      if (store === 'outbox') throw new Error('outbox unavailable');
      return realQuery(store, index, range);
    }) as typeof inner.query;
    const storage = new OutboxStorage(inner);
    await storage.put('attempts', { id: 'a1' });
    expect(await inner.get('attempts', 'a1')).toBeDefined();
  });

  it('enqueueExisting queues every record already on the device', async () => {
    const inner = new FakeStorageBackend();
    await inner.put('profiles', { id: 'p1' });
    await inner.put('attempts', { id: 'a1' });
    await inner.put('library', { profileId: 'p1', arrangementId: 'a' });
    const storage = new OutboxStorage(inner);
    expect(await storage.enqueueExisting()).toBe(3);
    expect((await queued(inner)).map((o) => o.store).sort()).toEqual(['attempts', 'library', 'profiles']);
  });
});
