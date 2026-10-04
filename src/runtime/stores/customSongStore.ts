// FR-STU-017 — songs the adult brought in (pasted chart, MIDI, MusicXML). Stored on the
// profile's settings record (TA-DAT-003) like savedSongIds and userProgressions, so
// they sync with no table of its own and are always in "My songs".

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import {
  customSongsOf,
  customSongToArrangement,
  makeCustomSong,
  type CustomSong,
  type CustomSongKind,
} from '../../core/content/customSong';
import type { Arrangement } from '../../core/content/types';
import { useSessionStore } from './sessionStore';

interface CustomSongState {
  songs: CustomSong[];
  load(): Promise<void>;
  add(input: { title: string; artist: string; kind: CustomSongKind; data: string }): Promise<{ ok: true; song: CustomSong } | { ok: false; error: string }>;
  remove(id: string): Promise<void>;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function save(profileId: string, customSongs: CustomSong[]): Promise<void> {
  const { storage } = getAdapters();
  const existing = await storage.get<Record<string, unknown>>('settings', profileId);
  await storage.put('settings', { ...existing, profileId, updatedAtMs: Date.now(), customSongs });
}

/** Reads one custom song off the current profile and builds its arrangement. */
export async function loadCustomArrangement(id: string): Promise<Arrangement> {
  const settings = await getAdapters().storage.get('settings', useSessionStore.getState().profile.id);
  const song = customSongsOf(settings).find((s) => s.id === id);
  if (!song) throw new Error('this song is not saved on this profile');
  const result = customSongToArrangement(song, song.kind === 'midi' ? base64ToBytes(song.data) : undefined);
  if (!result.ok) throw new Error(result.error);
  return result.arrangement;
}

export const useCustomSongStore = create<CustomSongState>((set, get) => ({
  songs: [],

  async load() {
    const settings = await getAdapters().storage.get('settings', useSessionStore.getState().profile.id);
    set({ songs: customSongsOf(settings) });
  },

  async add(input) {
    const made = makeCustomSong({ ...input, id: crypto.randomUUID(), addedAtMs: Date.now() });
    if (!made.ok) return made;
    const songs = [...get().songs, made.song];
    await save(useSessionStore.getState().profile.id, songs);
    set({ songs });
    return made;
  },

  async remove(id) {
    const songs = get().songs.filter((s) => s.id !== id);
    await save(useSessionStore.getState().profile.id, songs);
    set({ songs });
  },
}));
