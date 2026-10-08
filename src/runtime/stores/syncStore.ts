// Runtime sync state (Zustand, TA-APP-001), US-2.02/2.03. Owns the SyncEngine,
// the auth state the Studio panel shows, and the triggers that flush the
// outbox: a queued write (debounced), the network coming back, and a slow
// timer. Nothing here is awaited by a practice session (ADR-003).

import { create } from 'zustand';
import { getAdapters, isSyncConfigured, setEnqueueListener } from '../bootstrap';
import { displayName } from '../../adapters/sync/supabaseBackend';
import { SyncEngine, type KeyValueStore, type SyncOutcome } from '../syncEngine';

export type SyncStatus = 'unavailable' | 'signed-out' | 'backed-up' | 'syncing' | 'behind';

interface SyncState {
  configured: boolean;
  status: SyncStatus;
  email: string | undefined;
  pending: number;
  /** True after the sign-in link has been requested, until the adult returns through it. */
  linkSent: boolean;
  /** A plain-language problem with the last sign-in attempt, for the adult. */
  signInProblem: string | undefined;
  /** Counts completed syncs, so a screen can reload what a sync just pulled in. */
  syncRound: number;

  init(): Promise<void>;
  signIn(email: string): Promise<void>;
  signInWithPassword(username: string, pin: string): Promise<void>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
}

// The family signs in once, silently, with a key baked into the build (FR-SYN-001). Every device built
// with the same key lands on the same account, which is what makes localhost and the deployed
// site one library. A door-latch for a family app: the key is visible to anyone who opens the site.
const HOUSEHOLD_NAME = 'family';
const HOUSEHOLD_KEY = process.env.NEXT_PUBLIC_HOUSEHOLD_KEY;
const HOUSEHOLD_RETRY_MS = 60_000;
let lastHouseholdTryMs = 0;

const FLUSH_DEBOUNCE_MS = 2_000;
const FLUSH_INTERVAL_MS = 60_000;

const kv: KeyValueStore = {
  get: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: the cursor just restarts from the beginning, which is safe.
    }
  },
};

let engine: SyncEngine | undefined;
let started = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

const STATUS_OF: Record<SyncOutcome, SyncStatus> = {
  synced: 'backed-up',
  behind: 'behind',
  'signed-out': 'signed-out',
  offline: 'behind',
};

export const useSyncStore = create<SyncState>((set, get) => ({
  configured: isSyncConfigured,
  status: isSyncConfigured ? 'signed-out' : 'unavailable',
  email: undefined,
  pending: 0,
  linkSent: false,
  signInProblem: undefined,
  syncRound: 0,

  async init(): Promise<void> {
    if (started || !isSyncConfigured) return;
    started = true;
    const adapters = getAdapters();
    await adapters.storage.primeSeq().catch(() => undefined);
    engine = new SyncEngine({
      storage: adapters.rawStorage,
      backend: adapters.sync,
      kv,
      enqueueExisting: () => adapters.storage.enqueueExisting(),
      isOnline: () => navigator.onLine,
    });
    setEnqueueListener(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void get().syncNow(), FLUSH_DEBOUNCE_MS);
    });
    window.addEventListener('online', () => void get().syncNow());
    window.setInterval(() => void get().syncNow(), FLUSH_INTERVAL_MS);
    await get().syncNow();
  },

  async signIn(email: string): Promise<void> {
    set({ signInProblem: undefined });
    try {
      await getAdapters().sync.signIn(email.trim());
      set({ linkSent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      set({
        signInProblem: /rate|too many|seconds/i.test(message)
          ? 'Too many sign-in emails just now. Wait a few minutes and try again.'
          : 'Could not send the sign-in link. Check the address and your connection, then try again.',
      });
    }
  },

  async signInWithPassword(username: string, pin: string): Promise<void> {
    set({ signInProblem: undefined });
    try {
      await getAdapters().sync.signInWithPassword(username, pin);
      await get().syncNow();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      set({
        signInProblem: /wrong password/.test(message)
          ? 'That name is already used with a different PIN. Try the PIN again.'
          : /confirmation/.test(message)
            ? 'The backup account needs one setting changed in Supabase (turn off "Confirm email"). See the setup notes.'
            : /password/i.test(message) && /least|short|weak/i.test(message)
              ? 'Use a PIN of 4 to 6 digits.'
              : 'Could not sign in. Check your connection, then try again.',
      });
    }
  },

  async signOut(): Promise<void> {
    await getAdapters().sync.signOut().catch(() => undefined);
    set({ status: 'signed-out', email: undefined, pending: 0, linkSent: false });
  },

  async syncNow(): Promise<void> {
    if (!engine) return;
    let user = await getAdapters().sync.currentUser().catch(() => null);
    if (!user && HOUSEHOLD_KEY && navigator.onLine && Date.now() - lastHouseholdTryMs > HOUSEHOLD_RETRY_MS) {
      lastHouseholdTryMs = Date.now();
      await getAdapters().sync.signInWithPassword(HOUSEHOLD_NAME, HOUSEHOLD_KEY).catch(() => undefined);
      user = await getAdapters().sync.currentUser().catch(() => null);
    }
    if (!user) {
      set({ status: 'signed-out', email: undefined });
      return;
    }
    set({ status: 'syncing', email: displayName(user.email) });
    const outcome = await engine.sync();
    set({
      status: STATUS_OF[outcome],
      pending: await engine.pendingCount().catch(() => 0),
      syncRound: get().syncRound + 1,
    });
  },
}));
