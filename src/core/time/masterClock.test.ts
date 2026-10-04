import { describe, expect, it } from 'vitest';
import { MasterClock, type AudioClock } from './masterClock';
import { asSeconds, asTicks, type TempoMap } from './types';

class FakeAudioClock implements AudioClock {
  private time = asSeconds(0);
  now(): ReturnType<AudioClock['now']> {
    return this.time;
  }
  advance(seconds: number): void {
    this.time = asSeconds((this.time as number) + seconds);
  }
  set(seconds: number): void {
    this.time = asSeconds(seconds);
  }
}

describe('MasterClock', () => {
  // TS-U-CLK-001
  it('round-trips ticks through seconds at a constant tempo', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const clock = new MasterClock(new FakeAudioClock(), tempoMap);
    clock.start(asTicks(0));
    const audioTime = clock.ticksToAudio(asTicks(480));
    expect(clock.audioToTicks(audioTime)).toBeCloseTo(480, 6);
  });

  // TS-U-CLK-002
  it('honours a tempo change mid-map', () => {
    const tempoMap: TempoMap = [
      { atTick: asTicks(0), bpm: 120 }, // 4 bars @ 4/4 = 1920 ticks
      { atTick: asTicks(1920), bpm: 60 },
    ];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    // bar 6 => tick 2400 (1920 + 480 into the 60bpm section)
    const t = clock.ticksToAudio(asTicks(2400));
    const secondsAt120 = 1920 * (60 / 120 / 480);
    const secondsAt60 = 480 * (60 / 60 / 480);
    expect(t).toBeCloseTo(secondsAt120 + secondsAt60, 6);
  });

  // TS-U-CLK-003
  it('applies tempo scaling to durations', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    clock.setTempoScale(0.5);
    const t = clock.ticksToAudio(asTicks(480));
    // at 120bpm, 480 ticks (one quarter note at PPQ 480) is 0.5s at full speed;
    // at 0.5x scale the same musical distance should take twice as long in audio time
    expect(t).toBeCloseTo(1.0, 6);
  });

  // TS-U-CLK-010
  it('does not advance musical time while paused', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    audio.advance(1);
    const tickBeforePause = clock.audioToTicks(audio.now());
    clock.pause();
    audio.advance(5);
    const tickAfterPause = clock.audioToTicks(audio.now());
    expect(tickAfterPause).toBeCloseTo(tickBeforePause, 6);
  });

  // TS-U-CLK-011
  it('checkLoop snaps back to the loop start once the loop end is reached', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    clock.setLoop(asTicks(0), asTicks(480)); // one quarter note @ 120bpm = 0.5s
    expect(clock.checkLoop()).toBe(false);
    audio.advance(0.5);
    expect(clock.checkLoop()).toBe(true);
    expect(clock.audioToTicks(audio.now())).toBeCloseTo(0, 6);
  });

  // TS-U-CLK-012
  it('checkLoop is a no-op with no loop set, or while paused', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    audio.advance(10);
    expect(clock.checkLoop()).toBe(false);

    clock.setLoop(asTicks(0), asTicks(480));
    clock.pause();
    audio.advance(10);
    expect(clock.checkLoop()).toBe(false);
  });

  // TS-U-CLK-013
  it('clearLoop removes the loop range', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    clock.setLoop(asTicks(0), asTicks(480));
    expect(clock.loopRange).toEqual({ startTick: asTicks(0), endTick: asTicks(480) });
    clock.clearLoop();
    expect(clock.loopRange).toBeUndefined();
    audio.advance(0.5);
    expect(clock.checkLoop()).toBe(false);
  });

  // TS-U-CLK-014
  it('setLoop rejects a range whose end is not after its start', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const clock = new MasterClock(new FakeAudioClock(), tempoMap);
    clock.start(asTicks(0));
    expect(() => clock.setLoop(asTicks(480), asTicks(480))).toThrow();
    expect(() => clock.setLoop(asTicks(480), asTicks(0))).toThrow();
  });
  // TA-MAT-002 — wait mode holds the stream on the pending chord
  it('holds on a tick while audio time passes, then resumes from that tick', () => {
    const tempoMap: TempoMap = [{ atTick: asTicks(0), bpm: 120 }];
    const audio = new FakeAudioClock();
    const clock = new MasterClock(audio, tempoMap);
    clock.start(asTicks(0));
    audio.advance(5);
    clock.holdAt(asTicks(960));
    expect(clock.isHeld).toBe(true);
    audio.advance(10);
    expect(clock.audioToTicks(audio.now())).toBe(960);
    // a note 480 ticks ahead is still one beat (0.5 s) above the line
    expect((clock.ticksToAudio(asTicks(1440)) as number) - (audio.now() as number)).toBeCloseTo(0.5, 6);
    clock.resume();
    audio.advance(0.5);
    expect(clock.audioToTicks(audio.now())).toBeCloseTo(1440, 6);
  });
});
