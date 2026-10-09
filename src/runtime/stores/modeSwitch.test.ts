// TS-I-MID-006 — switching between waiting and playing in time mid-attempt keeps what was
// played, and a timed attempt ends on its own once the music has passed the last note.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioBackend, FakeClock, FakeMidiBackend, FakeStorageBackend } from '../../adapters/fake';
import { asMidiPitch } from '../../core/midi/decode';
import { asTicks } from '../../core/time/types';
import type { Arrangement, ContentNote } from '../../core/content/types';

const fakes = vi.hoisted(() => ({ adapters: undefined as unknown }));
vi.mock('../bootstrap', () => ({ getAdapters: () => fakes.adapters }));

import { useSessionStore } from './sessionStore';

// Four quarter notes at 120 bpm: one every half second.
const notes: ContentNote[] = [60, 62, 64, 65].map((pitch, i) => ({
  id: `n${i}`,
  trackId: 'rh',
  pitch: asMidiPitch(pitch),
  startTick: asTicks(i * 480),
  durationTicks: asTicks(400),
  groupId: `t${i * 480}`,
}));
const arrangement: Arrangement = {
  id: 'song:test',
  pieceId: 'song:test',
  difficulty: 1,
  tempoMap: [{ atTick: asTicks(0), bpm: 120 }],
  timeSig: [4, 4],
  keySig: 'C',
  tracks: [{ id: 'rh', role: 'rh', hand: 'R', notes }],
  sections: [{ id: 'all', label: 'All', startTick: asTicks(0), endTick: asTicks(1920), barRange: [1, 1], kind: 'quest' }],
  analysis: { pitchRange: 0, handPositionChanges: 0, rhythmicVocabulary: 0, handIndependence: 0, accidentalDensity: 0, overall: 1 },
};

let frames: FrameRequestCallback[] = [];
const runFrames = (): void => {
  const due = frames;
  frames = [];
  due.forEach((cb) => cb(0));
};

describe('switching mode mid-attempt', () => {
  let audio: FakeAudioBackend;
  let midiClock: FakeClock;
  let midi: FakeMidiBackend;
  const advance = (seconds: number): void => {
    audio.advanceClock(seconds);
    midiClock.advance(seconds);
  };

  beforeEach(async () => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    audio = new FakeAudioBackend();
    midiClock = new FakeClock();
    midi = new FakeMidiBackend(midiClock);
    fakes.adapters = { storage: new FakeStorageBackend(), midi, audio };
    const store = useSessionStore.getState();
    store.endSession();
    store.setAccompanimentMode('silent');
    store.setHoldAtLine(true);
    store.setAnyOctave(false);
    await store.selectMidiInput('fake-piano');
  });

  it('keeps the played note, stops holding, and finishes by itself when playing in time', async () => {
    await useSessionStore.getState().startArrangement(arrangement, 'rh', 'a1', '2026-10-09T09:00:00Z', undefined, 'wait');
    midi.loadFixture([{ atSeconds: 0, data: [0x90, 60, 80] }]);
    midi.pump();
    expect(useSessionStore.getState().matcherState?.groupIndex).toBe(1);

    useSessionStore.getState().switchMode('timed');
    expect(useSessionStore.getState().practiceMode).toBe('timed');
    expect(useSessionStore.getState().clock?.isHeld).toBe(false);
    // Nothing more is played; the music runs past the last note and the attempt ends.
    advance(3);
    runFrames();
    await vi.waitFor(() => expect(useSessionStore.getState().attemptStatus).toBe('complete'));
    const grade = useSessionStore.getState().grade;
    expect(grade?.accuracy).toBeCloseTo(0.25);
  });

  it('switching back to waiting holds the stream on the next unplayed note', async () => {
    await useSessionStore.getState().startArrangement(arrangement, 'rh', 'a2', '2026-10-09T09:00:00Z', undefined, 'timed');
    advance(0.6); // past the first note: in time, it has gone by
    useSessionStore.getState().switchMode('wait');
    expect(useSessionStore.getState().practiceMode).toBe('wait');
    advance(0.5); // reaches the third note's onset while the second was skipped
    runFrames();
    const clock = useSessionStore.getState().clock!;
    expect(clock.isHeld).toBe(true);
    expect(clock.audioToTicks(clock.nowAudio()) as number).toBe(960);
    midi.loadFixture([{ atSeconds: 1.1, data: [0x90, 64, 80] }]);
    midi.pump();
    expect(useSessionStore.getState().matcherState?.groupIndex).toBe(1);
  });
});
