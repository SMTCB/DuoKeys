// TS-I-SYN-002/003/005/006/007/008/010/011 — the outbox drains, retries without
// losing ops, and a fresh device restores from the server.

import { describe, expect, it } from 'vitest';
import { FakeStorageBackend } from '../adapters/fake/fakeStorageBackend';
import { OutboxStorage } from '../adapters/storage/outboxStorage';
import type { Cursor, OutboxOp, PullResult, PushResult, SyncBackend, SyncUser } from '../adapters/ports';
import type { PulledChange } from '../adapters/sync/mapping';
import { SyncEngine, type KeyValueStore } from './syncEngine';

class ScriptedBackend implements SyncBackend {
  user: SyncUser | null = { id: 'u1', email: 'a@example.com' };
  pushed: OutboxOp[] = [];
  /** How many ops the next push will accept; Infinity = all. */
  acceptNext = Infinity;
  remote: PulledChange[] = [];
  pullCalls: Cursor[] = [];
  async signIn(): Promise<void> {}
  async signInWithPassword(): Promise<void> {}
  async signOut(): Promise<void> {}
  async currentUser() {
    return this.user;
  }
  async push(ops: OutboxOp[]): Promise<PushResult> {
    const accepted = Math.min(ops.length, this.acceptNext);
    this.pushed.push(...ops.slice(0, accepted));
    return { accepted };
  }
  async pull(since: Cursor): Promise<PullResult> {
    this.pullCalls.push(since);
    const changes = since.startsWith('1970') ? this.remote : [];
    return { cursor: 'c1', changes };
  }
}

function memoryKv(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
}

function setup() {
  const raw = new FakeStorageBackend();
  const outbox = new OutboxStorage(raw, undefined, () => 1);
  const backend = new ScriptedBackend();
  const kv = memoryKv();
  let online = true;
  const engine = new SyncEngine({
    storage: raw,
    backend,
    kv,
    enqueueExisting: () => outbox.enqueueExisting(),
    isOnline: () => online,
  });
  return { raw, outbox, backend, kv, engine, setOnline: (v: boolean) => (online = v) };
}

describe('SyncEngine flush', () => {
  it('drains the outbox in seq order and empties it (TS-I-SYN-002)', async () => {
    const { outbox, backend, engine } = setup();
    await outbox.put('profiles', { id: 'p1' });
    await outbox.put('attempts', { id: 'a1' });
    expect(await engine.sync()).toBe('synced');
    expect(backend.pushed.map((o) => o.store)).toEqual(['profiles', 'attempts']);
    expect(await engine.pendingCount()).toBe(0);
  });

  it('keeps unsent ops when a push is partial, and sends them next time (TS-I-SYN-003)', async () => {
    const { outbox, backend, engine } = setup();
    await outbox.put('profiles', { id: 'p1' });
    await outbox.put('attempts', { id: 'a1' });
    await outbox.put('attempts', { id: 'a2' });
    backend.acceptNext = 1;
    expect(await engine.sync()).toBe('behind');
    expect(await engine.pendingCount()).toBe(2);

    backend.acceptNext = Infinity;
    expect(await engine.sync()).toBe('synced');
    expect(backend.pushed.map((o) => (o.payload as { value: { id: string } }).value.id)).toEqual(['p1', 'a1', 'a2']);
  });

  it('reports behind, not an error, when the backend throws (TS-I-SYN-010)', async () => {
    const { outbox, backend, engine } = setup();
    backend.push = async () => {
      throw new Error('project paused');
    };
    await outbox.put('attempts', { id: 'a1' });
    expect(await engine.sync()).toBe('behind');
    expect(await engine.pendingCount()).toBe(1);
  });

  it('does nothing while offline or signed out, and keeps the queue', async () => {
    const { outbox, backend, engine, setOnline } = setup();
    await outbox.put('attempts', { id: 'a1' });
    setOnline(false);
    expect(await engine.sync()).toBe('offline');
    setOnline(true);
    backend.user = null;
    expect(await engine.sync()).toBe('signed-out');
    expect(await engine.pendingCount()).toBe(1);
    expect(backend.pushed).toEqual([]);
  });

  it('queues data that predates the account once, on first link', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('profiles', { id: 'p1' });
    await raw.put('attempts', { id: 'a1' });
    await engine.sync();
    expect(backend.pushed).toHaveLength(2);
    await engine.sync();
    expect(backend.pushed).toHaveLength(2);
  });

  it('runs one sync at a time', async () => {
    const { engine } = setup();
    const a = engine.sync();
    const b = engine.sync();
    expect(a).toBe(b);
    await a;
  });
});

describe('sync never blocks practice (TS-I-SYN-009)', () => {
  it('local writes finish at normal speed while the network is hung', async () => {
    const { outbox, backend, engine } = setup();
    const hang = new Promise<never>(() => {});
    backend.push = () => hang;
    backend.pull = () => hang;
    backend.currentUser = () => hang;

    const flush = engine.sync(); // stays pending for the whole test
    let settled = false;
    void flush.then(() => (settled = true));

    // A full session's worth of writes: each resolves without waiting on the network.
    const session = (async () => {
      for (let i = 0; i < 200; i++) await outbox.put('attempts', { id: `a${i}` });
      await outbox.put('flashcards', { profileId: 'p1', cardId: 'C4' });
      await outbox.delete('library', 'p1+x');
    })();
    const timeout = new Promise((resolve) => setTimeout(() => resolve('blocked'), 2000));
    await expect(Promise.race([session.then(() => 'done'), timeout])).resolves.toBe('done');
    expect(settled).toBe(false);
    expect(await engine.pendingCount()).toBe(202);
  });

  it('a backend that throws never makes sync() reject', async () => {
    const { backend, engine } = setup();
    backend.currentUser = async () => {
      throw new Error('boom');
    };
    await expect(engine.sync()).resolves.toBe('behind');
  });
});

describe('SyncEngine restore (TS-I-SYN-005, 006, 007, 008, 011)', () => {
  const attempt = (id: string): PulledChange => ({ store: 'attempts', value: { id } });

  it('restores profiles and attempts onto a fresh device without queueing them', async () => {
    const { raw, backend, engine } = setup();
    backend.remote = [{ store: 'profiles', value: { id: 'p1' } }, attempt('a1')];
    await engine.sync();
    expect(await raw.get('profiles', 'p1')).toBeDefined();
    expect(await raw.get('attempts', 'a1')).toBeDefined();
    expect(await engine.pendingCount()).toBe(0);
    expect(backend.pushed).toEqual([]);
  });

  it('never overwrites an attempt it already has (TS-I-SYN-006)', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('attempts', { id: 'a1', local: true });
    backend.remote = [{ store: 'attempts', value: { id: 'a1', local: false } }];
    await engine.sync();
    expect(await raw.get('attempts', 'a1')).toEqual({ id: 'a1', local: true });
  });

  it('keeps both devices attempts when they differ (TS-I-SYN-008)', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('attempts', { id: 'mine' });
    backend.remote = [attempt('theirs')];
    await engine.sync();
    expect(await raw.get('attempts', 'mine')).toBeDefined();
    expect(await raw.get('attempts', 'theirs')).toBeDefined();
  });

  it('settings and library are last-write-wins on updatedAtMs (TS-I-SYN-007, 011)', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('settings', { profileId: 'p1', updatedAtMs: 100, theme: 'light' });
    await raw.put('library', { profileId: 'p1', arrangementId: 'a', status: 'learning', updatedAtMs: 500 });
    backend.remote = [
      { store: 'settings', value: { profileId: 'p1', updatedAtMs: 200, theme: 'dark' } },
      { store: 'library', value: { profileId: 'p1', arrangementId: 'a', status: 'learned', updatedAtMs: 400 } },
    ];
    await engine.sync();
    expect(await raw.get('settings', 'p1')).toMatchObject({ theme: 'dark' });
    expect(await raw.get('library', 'p1+a')).toMatchObject({ status: 'learning' });
  });

  it('removes a library entry another device cleared, unless the local one is newer', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('library', { profileId: 'p1', arrangementId: 'old', status: 'learning', updatedAtMs: 100 });
    await raw.put('library', { profileId: 'p1', arrangementId: 'fresh', status: 'learning', updatedAtMs: 900 });
    backend.remote = [
      { store: 'library', value: { profileId: 'p1', arrangementId: 'old', updatedAtMs: 200 }, deleted: true },
      { store: 'library', value: { profileId: 'p1', arrangementId: 'fresh', updatedAtMs: 200 }, deleted: true },
    ];
    await engine.sync();
    expect(await raw.get('library', 'p1+old')).toBeUndefined();
    expect(await raw.get('library', 'p1+fresh')).toBeDefined();
    expect(await engine.pendingCount()).toBe(0);
  });

  it('restores flashcards onto a fresh device but never overwrites a local card', async () => {
    const { raw, backend, engine } = setup();
    await raw.put('flashcards', { profileId: 'p1', cardId: 'D4', box: 5 });
    backend.remote = [
      { store: 'flashcards', value: { profileId: 'p1', cardId: 'C4', box: 2 } },
      { store: 'flashcards', value: { profileId: 'p1', cardId: 'D4', box: 1 } },
    ];
    await engine.sync();
    expect(await raw.get('flashcards', 'p1+C4')).toMatchObject({ box: 2 });
    expect(await raw.get('flashcards', 'p1+D4')).toMatchObject({ box: 5 });
  });

  it('resumes from the saved cursor next time', async () => {
    const { backend, engine, kv } = setup();
    await engine.sync();
    expect(kv.data.get('duokeys.sync.cursor.u1')).toBe('c1');
    await engine.sync();
    expect(backend.pullCalls.at(-1)).toBe('c1');
  });
});
