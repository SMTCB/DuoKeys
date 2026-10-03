// adapters/ports.ts — the entire platform surface of the application
//
// TA-PORT-002. Kept verbatim against docs/01-TECHNICAL-ARCHITECTURE.md — if you
// change a signature here, change it there too (CLAUDE.md § 1.2).

import type { Millis, Seconds } from '../core/time/types';
import type { MidiPitch } from '../core/midi/decode';
import type { Arrangement } from '../core/content/types';

export interface MidiBackend {
  listInputs(): Promise<MidiInputInfo[]>;
  open(id: string): Promise<void>;
  close(): Promise<void>;
  onMessage(cb: (msg: RawMidiMessage) => void): Unsubscribe;
  onStateChange(cb: (s: MidiConnectionState) => void): Unsubscribe;
}

export interface AudioBackend {
  now(): Seconds; // the master clock (ADR-006)
  playNote(pitch: MidiPitch, velocity: number, at?: Seconds): VoiceHandle;
  stopNote(h: VoiceHandle, at?: Seconds): void;
  playSample(id: SampleId, at?: Seconds): void; // rewards, metronome, cues
  setMasterGain(g: number): void;
  resume(): Promise<void>; // user-gesture unlock
}

export interface StorageBackend {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, value: T): Promise<void>;
  query<T>(store: StoreName, index: string, range: KeyRange): Promise<T[]>;
  delete(store: StoreName, key: string): Promise<void>;
  transaction<T>(stores: StoreName[], fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface SyncBackend {
  signIn(email: string): Promise<void>; // passwordless link
  signOut(): Promise<void>;
  currentUser(): Promise<SyncUser | null>;
  push(ops: OutboxOp[]): Promise<PushResult>;
  pull(since: Cursor): Promise<PullResult>;
}

export interface ContentBackend {
  index(): Promise<ContentIndex>;
  arrangement(id: ArrangementId): Promise<Arrangement>;
}

// --- Supporting types -------------------------------------------------------
// Not part of the verbatim TA-PORT-002 block, but required for it to compile.
// Kept intentionally minimal for Sprint 1; grown as later stories need more.

export type SampleId = string;
export type ArrangementId = string;
export type Unsubscribe = () => void;

export interface MidiInputInfo {
  id: string;
  name: string;
  manufacturer: string;
}

export interface RawMidiMessage {
  data: Uint8Array;
  timeStamp: Millis;
}

export type MidiConnectionState = 'connected' | 'disconnected';

export interface VoiceHandle {
  readonly id: number;
}

export type StoreName =
  | 'profiles'
  | 'arrangements'
  | 'attempts'
  | 'progression'
  | 'flashcards'
  | 'library'
  | 'settings'
  | 'outbox';

export interface KeyRange {
  lower?: unknown;
  upper?: unknown;
}

export interface Tx {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
}

export interface SyncUser {
  id: string;
  email: string;
}

export interface OutboxOp {
  seq: number;
  store: StoreName;
  op: 'put' | 'delete';
  payload: unknown;
}

export interface PushResult {
  accepted: number;
}

export type Cursor = string;

export interface PullResult {
  cursor: Cursor;
  changes: unknown[];
}

export interface ContentIndex {
  pieces: { id: string; title: string; defaultArrangementId: string }[];
}

export type { Arrangement };
