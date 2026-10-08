// TA-APP-002 — composition root. The only file that constructs adapters and
// injects them into core. Swapping WebMidiBackend for a future CoreMidiBackend
// (iPad, ADR-002) is a one-line change here.
//
// Storage is IdbBackend wrapped in OutboxStorage (TA-SYN-004), so every write to
// a synced store queues a sync op as a side effect. `rawStorage` is the
// undecorated store, used only to restore pulled data without re-queueing it.
//
// SyncBackend is SupabaseBackend when NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are set
// at build time, otherwise FakeSyncBackend (and `isSyncConfigured` is false, so
// the UI offers no sign-in). Sync is additive: the app works with neither (ADR-003).

import type { AudioBackend, ContentBackend, MidiBackend, StorageBackend, SyncBackend } from '../adapters/ports';
import { WebMidiBackend } from '../adapters/midi/webMidi';
import { WebAudioBackend } from '../adapters/audio/webAudio';
import { IdbBackend } from '../adapters/storage/idb';
import { StaticContentBackend } from '../adapters/content/static';
import { FakeSyncBackend } from '../adapters/fake/fakeSyncBackend';
import { OutboxStorage } from '../adapters/storage/outboxStorage';
import { SupabaseBackend } from '../adapters/sync/supabaseBackend';

export interface Adapters {
  midi: MidiBackend;
  audio: AudioBackend;
  storage: OutboxStorage;
  rawStorage: StorageBackend;
  sync: SyncBackend;
  content: ContentBackend;
}

let adapters: Adapters | undefined;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when a real Supabase project is wired in at build time. */
export const isSyncConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let enqueueListener: () => void = () => {};
/** The sync store registers here so a queued write can schedule a flush. */
export function setEnqueueListener(listener: () => void): void {
  enqueueListener = listener;
}

const DATA_GENERATION_KEY = 'duokeys.dataGeneration';
const DATA_GENERATION = 'family-pin-1';

/**
 * One-time clean slate for the family-PIN profile screen: profiles made before PINs existed (and
 * the sync cursor that went with them) are dropped the first time this version loads on a device.
 * The IndexedDB open that follows queues behind the delete, so it never sees the old data.
 */
function startFreshOnce(): void {
  try {
    if (window.localStorage.getItem(DATA_GENERATION_KEY) === DATA_GENERATION) return;
    window.localStorage.clear();
    window.indexedDB.deleteDatabase('duokeys');
    window.localStorage.setItem(DATA_GENERATION_KEY, DATA_GENERATION);
  } catch {
    /* blocked storage: carry on with whatever is there */
  }
}

/** Lazily constructed and memoized — WebAudioBackend opens an AudioContext, so this must run client-side and only once. */
export function getAdapters(): Adapters {
  if (typeof window === 'undefined') {
    throw new Error(
      'getAdapters() called outside the browser — WebAudioBackend opens a real AudioContext, so this composition ' +
        'root must only be reached from a client component (a module with "use client"), never a Server Component ' +
        'or anything it imports.',
    );
  }
  if (!adapters) {
    startFreshOnce();
    const rawStorage = new IdbBackend();
    adapters = {
      midi: new WebMidiBackend(),
      audio: new WebAudioBackend(),
      rawStorage,
      storage: new OutboxStorage(rawStorage, () => enqueueListener()),
      sync:
        SUPABASE_URL && SUPABASE_ANON_KEY
          ? new SupabaseBackend({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, redirectTo: `${window.location.origin}/studio` })
          : new FakeSyncBackend(),
      content: new StaticContentBackend(),
    };
  }
  return adapters;
}
