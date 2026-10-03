import { describe, expect, it } from 'vitest';
import { FakeClock } from './fakeClock';
import { FakeMidiBackend } from './fakeMidiBackend';
import { FakeAudioBackend } from './fakeAudioBackend';
import { FakeStorageBackend } from './fakeStorageBackend';
import { FakeSyncBackend } from './fakeSyncBackend';
import { FakeContentBackend } from './fakeContentBackend';
import { asMidiPitch } from '../../core/midi/decode';
import { asTicks } from '../../core/time/types';
import type { Arrangement } from '../ports';

describe('FakeClock', () => {
  it('only advances when told to', () => {
    const clock = new FakeClock();
    expect(clock.now()).toBe(0);
    clock.advance(1.5);
    expect(clock.now()).toBe(1.5);
  });
});

describe('FakeMidiBackend', () => {
  it('replays a fixture as the clock advances, in order, past events only', async () => {
    const clock = new FakeClock();
    const midi = new FakeMidiBackend(clock);
    const seen: number[] = [];
    midi.onMessage((msg) => seen.push(msg.data[1] ?? -1));
    await midi.open('fake-piano');
    midi.loadFixture([
      { atSeconds: 0.5, data: [0x90, 60, 80] },
      { atSeconds: 1.0, data: [0x90, 62, 80] },
    ]);

    midi.pump();
    expect(seen).toEqual([]);

    clock.advance(0.5);
    midi.pump();
    expect(seen).toEqual([60]);

    clock.advance(0.6);
    midi.pump();
    expect(seen).toEqual([60, 62]);
  });

  it('does not emit before open()', () => {
    const midi = new FakeMidiBackend(new FakeClock());
    const seen: number[] = [];
    midi.onMessage((msg) => seen.push(msg.data[1] ?? -1));
    midi.loadFixture([{ atSeconds: 0, data: [0x90, 60, 80] }]);
    midi.pump();
    expect(seen).toEqual([]);
  });
});

describe('FakeAudioBackend', () => {
  it('records played and stopped notes against its own clock', () => {
    const audio = new FakeAudioBackend();
    const handle = audio.playNote(asMidiPitch(60), 90);
    audio.advanceClock(0.25);
    audio.stopNote(handle);
    expect(audio.notesPlayed).toEqual([{ pitch: 60, velocity: 90, at: 0 }]);
    expect(audio.notesStopped).toEqual([{ handle, at: 0.25 }]);
  });
});

describe('FakeStorageBackend', () => {
  it('round-trips a put through get, keyed by id', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('profiles', { id: 'p1', displayName: 'Emma' });
    const back = await storage.get<{ id: string; displayName: string }>('profiles', 'p1');
    expect(back).toEqual({ id: 'p1', displayName: 'Emma' });
  });

  it('queries by an index field within a range', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('attempts', { id: 'a1', profileId: 'p1', startedAt: '2026-01-01' });
    await storage.put('attempts', { id: 'a2', profileId: 'p1', startedAt: '2026-06-01' });
    const results = await storage.query<{ id: string }>('attempts', 'startedAt', {
      lower: '2026-03-01',
    });
    expect(results.map((r) => r.id)).toEqual(['a2']);
  });

  it('deletes by key', async () => {
    const storage = new FakeStorageBackend();
    await storage.put('settings', { profileId: 'p1', volume: 0.8 });
    await storage.delete('settings', 'p1');
    expect(await storage.get('settings', 'p1')).toBeUndefined();
  });
});

describe('FakeSyncBackend', () => {
  it('tracks sign-in state and accepts pushed ops', async () => {
    const sync = new FakeSyncBackend();
    expect(await sync.currentUser()).toBeNull();
    await sync.signIn('parent@example.com');
    expect(await sync.currentUser()).toEqual({ id: 'fake-user', email: 'parent@example.com' });
    const result = await sync.push([{ seq: 1, store: 'attempts', op: 'put', payload: {} }]);
    expect(result.accepted).toBe(1);
  });
});

describe('FakeContentBackend', () => {
  it('serves arrangements it was constructed with, and throws for unknown ids', async () => {
    const arrangement: Arrangement = {
      id: 'arr-1',
      pieceId: 'piece-1',
      difficulty: 1,
      tempoMap: [{ atTick: asTicks(0), bpm: 100 }],
      timeSig: [4, 4],
      keySig: 'C',
      tracks: [],
      sections: [],
      analysis: {
        pitchRange: 0,
        handPositionChanges: 0,
        rhythmicVocabulary: 0,
        handIndependence: 0,
        accidentalDensity: 0,
        overall: 1,
      },
    };
    const content = new FakeContentBackend(
      [arrangement],
      [{ id: 'piece-1', title: 'Test Piece', defaultArrangementId: 'arr-1' }],
    );
    expect(await content.arrangement('arr-1')).toBe(arrangement);
    expect((await content.index()).pieces).toEqual([
      { id: 'piece-1', title: 'Test Piece', defaultArrangementId: 'arr-1' },
    ]);
    await expect(content.arrangement('nope')).rejects.toThrow();
  });
});
