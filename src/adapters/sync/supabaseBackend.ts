// TA-PORT-003 v1 adapter — SyncBackend over Supabase (TA-SYN-001..005, TA-SYN-007).
//
// Auth is a passwordless email link for the adult only (TA-SYN-002). Pushes are
// idempotent upserts on client-generated keys; attempts use ON CONFLICT DO
// NOTHING because they are append-only (TA-DAT-002) and the database has no
// UPDATE grant on them. Pulls page by the server-set `synced_at` column, so no
// client clock is trusted.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Cursor, OutboxOp, PullResult, PushResult, SyncBackend, SyncUser } from '../ports';
import {
  CONFLICT_COLUMNS,
  SYNCED_STORES,
  TABLE_OF,
  deleteFilter,
  fromRow,
  isSyncedStore,
  toRow,
  type DeleteEnvelope,
  type PulledChange,
  type PutEnvelope,
  type Row,
  type SyncedStore,
} from './mapping';

/** Rows per request. Kept well under PostgREST's default 1000-row page so a pull page never silently truncates. */
const PUSH_CHUNK = 50;
const PULL_PAGE = 500;

/** The cursor a brand-new device starts from. */
export const EPOCH_CURSOR: Cursor = '1970-01-01T00:00:00.000Z';

export interface SupabaseBackendOptions {
  url: string;
  anonKey: string;
  /** Where the magic link sends the adult back to. */
  redirectTo?: string;
  /** Tests inject a stub client; the app lets the backend create its own. */
  client?: SupabaseClient;
}

interface PostgrestFailure {
  code?: string;
  message?: string;
}

/**
 * A rejection the server will give every time (class 22 data exception, class 23
 * integrity violation). Retrying cannot help, so the op is dropped instead of
 * wedging every write queued behind it. Network errors, 401/PGRST301 (expired
 * session), 5xx and a missing column during a rollout are NOT permanent: they
 * leave the op queued. The record itself stays in IndexedDB, which is the truth.
 */
export function isPermanentRejection(error: PostgrestFailure): boolean {
  return /^2[23]/.test(error.code ?? '');
}

/** The household login is a username; Supabase Auth wants an email, so the username is wrapped in one that can never receive mail. */
export const HOUSEHOLD_DOMAIN = 'household.duokeys';
export const householdEmail = (username: string): string => `${username.trim().toLowerCase().replace(/\s+/g, '')}@${HOUSEHOLD_DOMAIN}`;
export const displayName = (email: string): string => email.replace(new RegExp(`@${HOUSEHOLD_DOMAIN}$`), '');

export class SupabaseBackend implements SyncBackend {
  private readonly client: SupabaseClient;
  private readonly redirectTo: string | undefined;

  constructor(options: SupabaseBackendOptions) {
    this.redirectTo = options.redirectTo;
    this.client =
      options.client ??
      createClient(options.url, options.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
  }

  async signIn(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: this.redirectTo === undefined ? {} : { emailRedirectTo: this.redirectTo },
    });
    if (error) throw new Error(error.message);
  }

  async signInWithPassword(username: string, password: string): Promise<void> {
    const email = householdEmail(username);
    const signedIn = await this.client.auth.signInWithPassword({ email, password });
    if (!signedIn.error) return;
    if (!/invalid login credentials/i.test(signedIn.error.message)) throw new Error(signedIn.error.message);
    // Either a wrong password or a first visit: try to create the account; an existing one refuses.
    const created = await this.client.auth.signUp({ email, password });
    if (created.error) throw new Error(/already|registered/i.test(created.error.message) ? 'wrong password' : created.error.message);
    if (!created.data.session) throw new Error('email confirmation is on');
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  async currentUser(): Promise<SyncUser | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return { id: user.id, email: user.email ?? '' };
  }

  /**
   * Pushes ops in seq order and stops at the first failure, so the caller can
   * drop exactly `accepted` ops and retry the rest — an attempt never lands
   * before the profile it references. Never throws on a rejected op; a thrown
   * error would hide how many were accepted.
   */
  async push(ops: OutboxOp[]): Promise<PushResult> {
    let accepted = 0;
    let i = 0;
    while (i < ops.length) {
      const first = ops[i];
      if (!first || !isSyncedStore(first.store)) {
        accepted += 1; // a non-synced op can never be sent; drop it rather than wedge the queue
        i += 1;
        continue;
      }
      let end = i + 1;
      while (end < ops.length && end - i < PUSH_CHUNK && ops[end]?.store === first.store && ops[end]?.op === first.op) end += 1;
      const run = ops.slice(i, end);
      const ok = first.op === 'put' ? await this.upsertRun(first.store, run) : await this.deleteRun(first.store, run);
      if (ok === 'transient') {
        // Isolate a permanently bad op from its neighbours: send the run one op at a time.
        if (run.length === 1) break;
        const done = await this.pushEach(run);
        accepted += done;
        if (done < run.length) break;
      } else {
        accepted += run.length;
      }
      i = end;
    }
    return { accepted };
  }

  /** Returns how many leading ops of `run` were settled (sent, or dropped as permanently rejected). */
  private async pushEach(run: OutboxOp[]): Promise<number> {
    let done = 0;
    for (const op of run) {
      const store = op.store as SyncedStore;
      const ok = op.op === 'put' ? await this.upsertRun(store, [op]) : await this.deleteRun(store, [op]);
      if (ok === 'transient') break;
      done += 1;
    }
    return done;
  }

  /** 'ok' = sent or dropped as permanently rejected; 'transient' = leave it queued and retry. */
  private settle(store: SyncedStore, error: PostgrestFailure | null): 'ok' | 'transient' {
    if (error === null) return 'ok';
    if (!isPermanentRejection(error)) return 'transient';
    console.warn(`DuoKeys sync: dropped a ${store} write the server rejects permanently (${error.code ?? 'unknown'})`);
    return 'ok';
  }

  private async upsertRun(store: SyncedStore, run: OutboxOp[]): Promise<'ok' | 'transient'> {
    // Within one run a later put to the same key supersedes an earlier one.
    const byKey = new Map<string, Row>();
    for (const op of run) {
      const { value, atMs } = op.payload as PutEnvelope;
      const row = toRow(store, value, atMs);
      byKey.set(CONFLICT_COLUMNS[store].split(',').map((c) => String(row[c])).join('+'), row);
    }
    const { error } = await this.client
      .from(TABLE_OF[store])
      .upsert([...byKey.values()], { onConflict: CONFLICT_COLUMNS[store], ignoreDuplicates: store === 'attempts' });
    return this.settle(store, error);
  }

  /**
   * `library` clears are tombstones, not deletes, so a pull can carry them to
   * other devices; the server's last-write-wins trigger orders them against
   * edits. Everything else is a hard delete (nothing in the app issues one).
   */
  private async deleteRun(store: SyncedStore, run: OutboxOp[]): Promise<'ok' | 'transient'> {
    for (const op of run) {
      const { key, atMs } = op.payload as DeleteEnvelope;
      const table = this.client.from(TABLE_OF[store]);
      const { error } =
        store === 'library'
          ? await table.update({ deleted: true, updated_at_ms: atMs }).match(deleteFilter(store, key))
          : await table.delete().match(deleteFilter(store, key));
      if (this.settle(store, error) === 'transient') return 'transient';
    }
    return 'ok';
  }

  /**
   * Everything written since `since`, mapped to local shapes. If a table fills
   * a page the cursor is held at that page's last row so the next call resumes
   * there; rows from other tables fetched past it are simply re-applied, which
   * is harmless because applying a change is idempotent.
   */
  async pull(since: Cursor): Promise<PullResult> {
    const changes: PulledChange[] = [];
    let newest = since;
    let truncatedAt: Cursor | undefined;
    for (const store of SYNCED_STORES) {
      const { data, error } = await this.client
        .from(TABLE_OF[store])
        .select('*')
        .gt('synced_at', since)
        .order('synced_at', { ascending: true })
        .limit(PULL_PAGE);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      for (const row of rows) {
        const value = fromRow(store, row);
        changes.push(row.deleted === true ? { store, value, deleted: true } : { store, value });
      }
      const last = rows[rows.length - 1];
      if (last) {
        const at = String(last.synced_at);
        if (at > newest) newest = at;
        if (rows.length === PULL_PAGE && (truncatedAt === undefined || at < truncatedAt)) truncatedAt = at;
      }
    }
    return { cursor: truncatedAt ?? newest, changes };
  }
}
