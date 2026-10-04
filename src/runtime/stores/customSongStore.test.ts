// TS-I-DAT-010 — custom songs (FR-STU-017) live on the profile's settings record beside its other
// fields, survive a reload, are kept apart per profile, and a MIDI import round-trips through base64.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import type { Profile } from '../../core/profile/types';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));

import { base64ToBytes, bytesToBase64, loadCustomArrangement, useCustomSongStore } from './customSongStore';
import { useSessionStore } from './sessionStore';

const profile = (id: string) =>
  ({ id, displayName: id, role: 'student', keyboardRange: { low: 21, high: 108 }, latencyOffsetMs: 0, toleranceScale: 1, avatar: 'piano' }) as Profile;

// Format 0, 480 ticks per quarter, two quarter notes (C4 then E4).
const TWO_NOTES = Uint8Array.from([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 22,
  0x00, 0x90, 0x3c, 0x64, 0x83, 0x60, 0x80, 0x3c, 0x00, 0x00, 0x90, 0x40, 0x64, 0x83, 0x60, 0x80, 0x40, 0x00,
  0x00, 0xff, 0x2f, 0x00,
]);

describe('custom songs', () => {
  let storage: FakeStorageBackend;

  beforeEach(() => {
    storage = new FakeStorageBackend();
    fakes.adapters = { storage, midi: new FakeMidiBackend(new FakeClock()), audio: new FakeAudioBackend() };
    useSessionStore.getState().setProfile(profile('p1'));
    useCustomSongStore.setState({ songs: [] });
  });

  it('saves a pasted chart on the settings record without disturbing other fields, and plays it back', async () => {
    await storage.put('settings', { profileId: 'p1', updatedAtMs: 1, savedSongIds: ['a'] });
    const added = await useCustomSongStore.getState().add({ title: 'Wonderwall', artist: 'Oasis', kind: 'chart', data: 'Em7 G Dsus4 A7sus4' });
    expect(added.ok).toBe(true);

    const saved = await storage.get<{ savedSongIds?: string[]; customSongs?: unknown[] }>('settings', 'p1');
    expect(saved?.savedSongIds).toEqual(['a']);
    expect(saved?.customSongs).toHaveLength(1);

    const id = added.ok ? added.song.id : '';
    expect(id.startsWith('custom:')).toBe(true);
    const arrangement = await loadCustomArrangement(id);
    expect(arrangement.id).toBe(id);
  });

  it('brings songs back after a reload, keeps profiles apart, and removes them', async () => {
    const added = await useCustomSongStore.getState().add({ title: 'Mine', artist: '', kind: 'chart', data: 'C G Am F' });
    const id = added.ok ? added.song.id : '';

    useCustomSongStore.setState({ songs: [] });
    await useCustomSongStore.getState().load();
    expect(useCustomSongStore.getState().songs.map((s) => s.id)).toEqual([id]);

    useSessionStore.getState().setProfile(profile('p2'));
    await useCustomSongStore.getState().load();
    expect(useCustomSongStore.getState().songs).toEqual([]);

    useSessionStore.getState().setProfile(profile('p1'));
    await useCustomSongStore.getState().load();
    await useCustomSongStore.getState().remove(id);
    expect(useCustomSongStore.getState().songs).toEqual([]);
    await expect(loadCustomArrangement(id)).rejects.toThrow();
  });

  it('refuses a song with no readable chords and saves nothing', async () => {
    const added = await useCustomSongStore.getState().add({ title: 'Lyrics only', artist: '', kind: 'chart', data: 'just some words here' });
    expect(added.ok).toBe(false);
    expect(await storage.get('settings', 'p1')).toBeUndefined();
  });

  it('refuses a file that is not MIDI instead of saving it', async () => {
    const added = await useCustomSongStore.getState().add({ title: 'Junk', artist: '', kind: 'midi', data: bytesToBase64(Uint8Array.from([1, 2, 3, 4])) });
    expect(added.ok).toBe(false);
    expect(useCustomSongStore.getState().songs).toEqual([]);
  });

  it('plays a MusicXML piece whose bar count is odd, using one-bar sections', async () => {
    const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>16</duration><voice>1</voice><staff>1</staff></note></measure></part></score-partwise>`;
    const added = await useCustomSongStore.getState().add({ title: 'One bar', artist: '', kind: 'musicxml', data: xml });
    expect(added.ok).toBe(true);
    const arrangement = await loadCustomArrangement(added.ok ? added.song.id : '');
    expect(arrangement.tracks.flatMap((t) => t.notes).length).toBe(1);
  });

  it('keeps a MIDI import intact through base64 and plays it', async () => {
    expect(Array.from(base64ToBytes(bytesToBase64(TWO_NOTES)))).toEqual(Array.from(TWO_NOTES));
    const added = await useCustomSongStore.getState().add({ title: 'Two notes', artist: '', kind: 'midi', data: bytesToBase64(TWO_NOTES) });
    expect(added.ok).toBe(true);
    const arrangement = await loadCustomArrangement(added.ok ? added.song.id : '');
    expect(arrangement.tracks.flatMap((t) => t.notes).length).toBe(2);
  });
});
