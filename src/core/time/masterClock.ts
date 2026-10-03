// TA-CLK-002 — MasterClock: the single place wall, audio and musical time meet.
//
// core/ imports nothing but core/ (TA-PORT-001), so MasterClock does not import
// the AudioBackend port from adapters/. It depends on the minimal shape it
// actually needs (AudioClock below) — any AudioBackend satisfies it structurally,
// so the composition root (runtime/bootstrap.ts) can hand one in directly.

import type { Seconds, Ticks, TempoMap } from './types';
import { asSeconds, asTicks } from './types';

export interface AudioClock {
  now(): Seconds;
}

/** Seconds elapsed between tick 0 and `ticks`, integrating over tempo breakpoints. */
function ticksToSecondsFromZero(tempoMap: TempoMap, ticks: Ticks): Seconds {
  if (tempoMap.length === 0) {
    throw new Error('MasterClock: tempoMap must have at least one point');
  }
  let seconds = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    const point = tempoMap[i]!;
    const nextAtTick = i + 1 < tempoMap.length ? tempoMap[i + 1]!.atTick : ticks;
    const segmentEndTick = Math.min(nextAtTick, ticks);
    const segmentTicks = Math.max(0, segmentEndTick - point.atTick);
    const secondsPerTick = 60 / point.bpm / 480;
    seconds += segmentTicks * secondsPerTick;
    if (ticks <= nextAtTick) break;
  }
  return asSeconds(seconds);
}

/** Inverse of ticksToSecondsFromZero: which tick is `seconds` after tick 0. */
function secondsToTicksFromZero(tempoMap: TempoMap, seconds: Seconds): Ticks {
  if (tempoMap.length === 0) {
    throw new Error('MasterClock: tempoMap must have at least one point');
  }
  let remaining = seconds as number;
  for (let i = 0; i < tempoMap.length; i++) {
    const point = tempoMap[i]!;
    const secondsPerTick = 60 / point.bpm / 480;
    const nextAtTick = i + 1 < tempoMap.length ? tempoMap[i + 1]!.atTick : undefined;
    const segmentTicks = nextAtTick === undefined ? Infinity : nextAtTick - point.atTick;
    const segmentSeconds = segmentTicks * secondsPerTick;
    if (remaining <= segmentSeconds || nextAtTick === undefined) {
      return asTicks(point.atTick + remaining / secondsPerTick);
    }
    remaining -= segmentSeconds;
  }
  return asTicks(0);
}

export class MasterClock {
  private startTick: Ticks = asTicks(0);
  private startAudioTime: Seconds | undefined;
  private tempoScale = 1;
  private loopStartTick: Ticks | undefined;
  private loopEndTick: Ticks | undefined;

  constructor(
    private readonly audio: AudioClock,
    private readonly tempoMap: TempoMap,
  ) {}

  nowAudio(): Seconds {
    return this.audio.now();
  }

  audioToTicks(t: Seconds): Ticks {
    if (this.startAudioTime === undefined) return this.startTick;
    const elapsedAudio = ((t as number) - (this.startAudioTime as number)) * this.tempoScale;
    const startSeconds = ticksToSecondsFromZero(this.tempoMap, this.startTick) as number;
    return secondsToTicksFromZero(this.tempoMap, asSeconds(startSeconds + elapsedAudio));
  }

  ticksToAudio(ticks: Ticks): Seconds {
    const startSeconds = ticksToSecondsFromZero(this.tempoMap, this.startTick) as number;
    const targetSeconds = ticksToSecondsFromZero(this.tempoMap, ticks) as number;
    const deltaAudio = (targetSeconds - startSeconds) / this.tempoScale;
    const base = this.startAudioTime === undefined ? this.audio.now() : this.startAudioTime;
    return asSeconds((base as number) + deltaAudio);
  }

  start(atTick: Ticks): void {
    this.startTick = atTick;
    this.startAudioTime = this.audio.now();
  }

  pause(): void {
    if (this.startAudioTime === undefined) return;
    this.startTick = this.audioToTicks(this.audio.now());
    this.startAudioTime = undefined;
  }

  setTempoScale(scale: number): void {
    if (scale < 0.3 || scale > 1.0) {
      throw new Error(`MasterClock: tempoScale ${scale} outside [0.30, 1.00] (FR-STU-004)`);
    }
    // Re-anchor so the scale change takes effect from "now", not from tick 0.
    if (this.startAudioTime !== undefined) {
      this.startTick = this.audioToTicks(this.audio.now());
      this.startAudioTime = this.audio.now();
    }
    this.tempoScale = scale;
  }

  /** FR-STU-003 — loop a measure range indefinitely. Half-open [startTick, endTick). */
  setLoop(startTick: Ticks, endTick: Ticks): void {
    if ((endTick as number) <= (startTick as number)) {
      throw new Error(`MasterClock: loop end ${endTick as number} must be after loop start ${startTick as number}`);
    }
    this.loopStartTick = startTick;
    this.loopEndTick = endTick;
  }

  clearLoop(): void {
    this.loopStartTick = undefined;
    this.loopEndTick = undefined;
  }

  get loopRange(): { startTick: Ticks; endTick: Ticks } | undefined {
    return this.loopStartTick !== undefined && this.loopEndTick !== undefined
      ? { startTick: this.loopStartTick, endTick: this.loopEndTick }
      : undefined;
  }

  /**
   * Call once per frame/poll while playing. Restarts playback at the loop
   * start once the current position reaches the loop end. No-op when no loop
   * is set or the clock is paused. Returns true the instant it loops, so the
   * caller can grade the pass that just finished (US-3.06).
   */
  checkLoop(): boolean {
    if (this.loopStartTick === undefined || this.loopEndTick === undefined) return false;
    if (this.startAudioTime === undefined) return false;
    const currentTick = this.audioToTicks(this.audio.now());
    if ((currentTick as number) >= (this.loopEndTick as number)) {
      this.start(this.loopStartTick);
      return true;
    }
    return false;
  }
}
