// TA-SYN-007 — pure mapping between local IndexedDB records (camelCase,
// TA-DAT-002/004/007) and Supabase rows (snake_case). No I/O, so it is unit
// tested without a network.
//
// Outbox payloads (TA-SYN-004) are envelopes:
//   put    { value: <local record>, atMs }
//   delete { key: <store key>,      atMs }
// `atMs` is the wall-clock time of the local write. Profiles carry no
// updatedAt of their own (TA-DAT-004), so it becomes `updated_at_ms`, which
// the server's last-write-wins trigger compares (TA-SYN-003).

import type { StoreName } from '../ports';
import type { Profile } from '../../core/profile/types';
import type { Attempt } from '../../core/data/attempt';
import type { LibraryEntry } from '../../core/data/library';
import type { Flashcard } from '../../core/data/flashcard';
import { asMidiPitch } from '../../core/midi/decode';
import { asMillis } from '../../core/time/types';

/** Stores whose writes are queued to the outbox. `progression` is derived and never synced (TA-SYN-003). */
export const SYNCED_STORES = ['profiles', 'attempts', 'library', 'settings', 'flashcards'] as const;
export type SyncedStore = (typeof SYNCED_STORES)[number];

export function isSyncedStore(store: StoreName): store is SyncedStore {
  return (SYNCED_STORES as readonly string[]).includes(store);
}

/** Server table for each synced store — the names are the same. */
export const TABLE_OF: Record<SyncedStore, string> = {
  profiles: 'profiles',
  attempts: 'attempts',
  library: 'library',
  settings: 'settings',
  flashcards: 'flashcards',
};

export interface PutEnvelope<T = unknown> {
  value: T;
  atMs: number;
}
export interface DeleteEnvelope {
  key: string;
  atMs: number;
}

/** A local-shape change returned by SyncBackend.pull(). */
export interface PulledChange {
  store: SyncedStore;
  value: unknown;
  /** A tombstone: the record was cleared on another device. `value` still carries its key and updatedAtMs. Only `library` has them. */
  deleted?: true;
}

export type Row = Record<string, unknown>;

export interface LocalSettings {
  profileId: string;
  updatedAtMs: number;
  [field: string]: unknown;
}

export function toRow(store: SyncedStore, value: unknown, atMs: number): Row {
  switch (store) {
    case 'profiles': {
      const p = value as Profile;
      return {
        id: p.id,
        display_name: p.displayName,
        role: p.role,
        keyboard_low: p.keyboardRange.low,
        keyboard_high: p.keyboardRange.high,
        latency_offset_ms: p.latencyOffsetMs,
        tolerance_scale: p.toleranceScale,
        midi_input_id: p.midiInputId ?? null,
        avatar: p.avatar,
        updated_at_ms: atMs,
      };
    }
    case 'attempts': {
      const a = value as Attempt;
      return {
        id: a.id,
        profile_id: a.profileId,
        arrangement_id: a.arrangementId,
        section_id: a.sectionId ?? null,
        started_at: a.startedAt,
        duration_ms: Math.round(a.durationMs),
        mode: a.mode,
        tempo_scale: a.tempoScale,
        grade: a.grade,
        events: a.events,
        app_version: a.appVersion,
      };
    }
    case 'library': {
      const l = value as LibraryEntry;
      return {
        profile_id: l.profileId,
        arrangement_id: l.arrangementId,
        status: l.status,
        added_at_ms: l.addedAtMs,
        updated_at_ms: l.updatedAtMs,
        deleted: false,
      };
    }
    case 'settings': {
      const { profileId, updatedAtMs, ...data } = value as LocalSettings;
      return { profile_id: profileId, data, updated_at_ms: updatedAtMs ?? atMs };
    }
    case 'flashcards': {
      const c = value as Flashcard;
      return {
        profile_id: c.profileId,
        card_id: c.cardId,
        pitch: c.pitch,
        box: c.box,
        due_at_ms: Math.round(c.dueAtMs),
        updated_at_ms: atMs,
      };
    }
  }
}

export function fromRow(store: SyncedStore, row: Row): unknown {
  switch (store) {
    case 'profiles': {
      const profile: Profile = {
        id: String(row.id),
        displayName: String(row.display_name),
        role: row.role as Profile['role'],
        keyboardRange: { low: asMidiPitch(Number(row.keyboard_low)), high: asMidiPitch(Number(row.keyboard_high)) },
        latencyOffsetMs: Number(row.latency_offset_ms),
        toleranceScale: Number(row.tolerance_scale),
        avatar: String(row.avatar),
      };
      return typeof row.midi_input_id === 'string' ? { ...profile, midiInputId: row.midi_input_id } : profile;
    }
    case 'attempts': {
      const attempt: Attempt = {
        id: String(row.id),
        profileId: String(row.profile_id),
        arrangementId: String(row.arrangement_id),
        startedAt: new Date(String(row.started_at)).toISOString(),
        durationMs: Number(row.duration_ms),
        mode: row.mode as Attempt['mode'],
        tempoScale: Number(row.tempo_scale),
        grade: row.grade as Attempt['grade'],
        events: row.events as Attempt['events'],
        appVersion: String(row.app_version),
      };
      return typeof row.section_id === 'string' ? { ...attempt, sectionId: row.section_id } : attempt;
    }
    case 'library': {
      const entry: LibraryEntry = {
        profileId: String(row.profile_id),
        arrangementId: String(row.arrangement_id),
        status: row.status as LibraryEntry['status'],
        addedAtMs: asMillis(Number(row.added_at_ms)),
        updatedAtMs: asMillis(Number(row.updated_at_ms)),
      };
      return entry;
    }
    case 'settings': {
      const settings: LocalSettings = {
        ...(row.data as Record<string, unknown>),
        profileId: String(row.profile_id),
        updatedAtMs: Number(row.updated_at_ms),
      };
      return settings;
    }
    case 'flashcards': {
      const card: Flashcard = {
        profileId: String(row.profile_id),
        cardId: String(row.card_id),
        pitch: asMidiPitch(Number(row.pitch)),
        box: Number(row.box) as Flashcard['box'],
        dueAtMs: asMillis(Number(row.due_at_ms)),
      };
      return card;
    }
  }
}

/** Split a local store key into the server columns a delete needs. `library` and `flashcards` have composite keys. */
export function deleteFilter(store: SyncedStore, key: string): Row {
  switch (store) {
    case 'library':
    case 'flashcards': {
      const at = key.indexOf('+');
      const rest = key.slice(at + 1);
      return store === 'library'
        ? { profile_id: key.slice(0, at), arrangement_id: rest }
        : { profile_id: key.slice(0, at), card_id: rest };
    }
    case 'settings':
      return { profile_id: key };
    case 'profiles':
    case 'attempts':
      return { id: key };
  }
}

/** The on-conflict target for an upsert. */
export const CONFLICT_COLUMNS: Record<SyncedStore, string> = {
  profiles: 'id',
  attempts: 'id',
  library: 'profile_id,arrangement_id',
  settings: 'profile_id',
  flashcards: 'profile_id,card_id',
};
