// TA-APP-002 — composition root. The only file that constructs adapters and
// injects them into core. Swapping WebMidiBackend for a future CoreMidiBackend
// (iPad, ADR-002) is a one-line change here.
//
// SyncBackend is FakeSyncBackend for now: auth and sync flush are explicitly
// out of scope for Sprint 1 (docs/03-SPRINT-PLAN.md), so no real Supabase
// adapter exists yet. Swapping it in later does not touch this file's shape.

import type { AudioBackend, ContentBackend, MidiBackend, StorageBackend, SyncBackend } from '../adapters/ports';
import { WebMidiBackend } from '../adapters/midi/webMidi';
import { WebAudioBackend } from '../adapters/audio/webAudio';
import { IdbBackend } from '../adapters/storage/idb';
import { StaticContentBackend } from '../adapters/content/static';
import { FakeSyncBackend } from '../adapters/fake/fakeSyncBackend';

export interface Adapters {
  midi: MidiBackend;
  audio: AudioBackend;
  storage: StorageBackend;
  sync: SyncBackend;
  content: ContentBackend;
}

let adapters: Adapters | undefined;

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
    adapters = {
      midi: new WebMidiBackend(),
      audio: new WebAudioBackend(),
      storage: new IdbBackend(),
      sync: new FakeSyncBackend(),
      content: new StaticContentBackend(),
    };
  }
  return adapters;
}
