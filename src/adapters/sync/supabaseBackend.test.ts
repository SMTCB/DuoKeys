// US-2.03 hardening — how SupabaseBackend settles rejected writes, tombstones
// library clears, and surfaces them on pull. A stub stands in for the client.

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OutboxOp } from '../ports';
import type { PulledChange } from './mapping';
import { isPermanentRejection, SupabaseBackend } from './supabaseBackend';

type Failure = { code?: string; message?: string } | null;

interface Call {
  table: string;
  kind: 'upsert' | 'update' | 'delete';
  arg?: unknown;
  filter?: unknown;
}

function stub(opts: { fail?: (call: Call) => Failure; pullRows?: Record<string, unknown[]> } = {}) {
  const calls: Call[] = [];
  const answer = (call: Call) => {
    calls.push(call);
    return Promise.resolve({ error: opts.fail?.(call) ?? null });
  };
  const client = {
    from: (table: string) => ({
      upsert: (arg: unknown) => answer({ table, kind: 'upsert', arg }),
      update: (arg: unknown) => ({ match: (filter: unknown) => answer({ table, kind: 'update', arg, filter }) }),
      delete: () => ({ match: (filter: unknown) => answer({ table, kind: 'delete', filter }) }),
      select: () => {
        const q = {
          gt: () => q,
          order: () => q,
          limit: () => Promise.resolve({ data: opts.pullRows?.[table] ?? [], error: null }),
        };
        return q;
      },
    }),
  } as unknown as SupabaseClient;
  const backend = new SupabaseBackend({ url: 'http://x', anonKey: 'k', client });
  return { backend, calls };
}

const put = (seq: number, store: OutboxOp['store'], value: unknown): OutboxOp => ({
  seq,
  store,
  op: 'put',
  payload: { value, atMs: 10 },
});
const profile = (id: string) => ({
  id,
  displayName: 'Mia',
  role: 'explorer',
  keyboardRange: { low: 21, high: 108 },
  latencyOffsetMs: 0,
  toleranceScale: 1,
  avatar: 'piano',
});

describe('isPermanentRejection', () => {
  it('treats data and integrity errors as permanent, everything else as retryable', () => {
    expect(isPermanentRejection({ code: '23503' })).toBe(true);
    expect(isPermanentRejection({ code: '22P02' })).toBe(true);
    expect(isPermanentRejection({ code: '42501' })).toBe(false);
    expect(isPermanentRejection({ code: 'PGRST301' })).toBe(false);
    expect(isPermanentRejection({ code: 'PGRST204' })).toBe(false);
    expect(isPermanentRejection({ message: 'Failed to fetch' })).toBe(false);
  });
});

describe('SupabaseBackend.push', () => {
  it('drops a permanently rejected op so it cannot wedge the queue behind it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { backend } = stub({
      fail: (c) => ((c.arg as { id: string }[]).some((r) => r.id === 'bad') ? { code: '23503' } : null),
    });
    const ops = [put(1, 'profiles', profile('ok1')), put(2, 'profiles', profile('bad')), put(3, 'profiles', profile('ok2'))];
    expect(await backend.push(ops)).toEqual({ accepted: 3 });
  });

  it('keeps a transiently failing op queued and stops there', async () => {
    const { backend } = stub({
      fail: (c) => ((c.arg as { id: string }[]).some((r) => r.id === 'down') ? { message: 'Failed to fetch' } : null),
    });
    const ops = [put(1, 'profiles', profile('ok1')), put(2, 'profiles', profile('down')), put(3, 'profiles', profile('ok2'))];
    expect(await backend.push(ops)).toEqual({ accepted: 1 });
  });

  it('clears a library entry with a tombstone update, not a hard delete', async () => {
    const { backend, calls } = stub();
    const op: OutboxOp = { seq: 1, store: 'library', op: 'delete', payload: { key: 'p1+mary-d1', atMs: 77 } };
    expect(await backend.push([op])).toEqual({ accepted: 1 });
    expect(calls).toEqual([
      {
        table: 'library',
        kind: 'update',
        arg: { deleted: true, updated_at_ms: 77 },
        filter: { profile_id: 'p1', arrangement_id: 'mary-d1' },
      },
    ]);
  });

  it('sends flashcards to their own table', async () => {
    const { backend, calls } = stub();
    const card = { profileId: 'p1', cardId: 'C4', pitch: 60, box: 2, dueAtMs: 5000 };
    expect(await backend.push([put(1, 'flashcards', card)])).toEqual({ accepted: 1 });
    expect(calls[0]).toMatchObject({
      table: 'flashcards',
      kind: 'upsert',
      arg: [{ profile_id: 'p1', card_id: 'C4', pitch: 60, box: 2, due_at_ms: 5000, updated_at_ms: 10 }],
    });
  });
});

describe('SupabaseBackend.pull', () => {
  it('flags tombstoned library rows as deleted and maps flashcards', async () => {
    const { backend } = stub({
      pullRows: {
        library: [
          {
            profile_id: 'p1',
            arrangement_id: 'a',
            status: 'learning',
            added_at_ms: 1,
            updated_at_ms: 5,
            deleted: true,
            synced_at: '2026-10-03T10:00:00.000Z',
          },
          {
            profile_id: 'p1',
            arrangement_id: 'b',
            status: 'learned',
            added_at_ms: 1,
            updated_at_ms: 6,
            deleted: false,
            synced_at: '2026-10-03T10:00:01.000Z',
          },
        ],
        flashcards: [
          { profile_id: 'p1', card_id: 'C4', pitch: 60, box: 3, due_at_ms: 9, updated_at_ms: 4, synced_at: '2026-10-03T10:00:02.000Z' },
        ],
      },
    });
    const result = await backend.pull('1970-01-01T00:00:00.000Z');
    const changes = result.changes as PulledChange[];
    const { cursor } = result;
    expect(changes.filter((change) => change.deleted)).toHaveLength(1);
    expect(changes.find((change) => change.store === 'flashcards')?.value).toEqual({
      profileId: 'p1',
      cardId: 'C4',
      pitch: 60,
      box: 3,
      dueAtMs: 9,
    });
    expect(cursor).toBe('2026-10-03T10:00:02.000Z');
  });
});
