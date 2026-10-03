// TA-MAT-003 — TimedMatcher: timing-aware grading for US-2.15.
//
// Unlike WaitMatcher, the stream does not freeze. An incoming note is matched
// against the nearest unconsumed expected note of the SAME PITCH within
// `2 x loose` of "now" (TA-MAT-006) — matching the doc's algorithm verbatim.
// A note with no same-pitch candidate in range is `extra`, never `wrong`:
// searching by time distance alone (ignoring pitch) would let a nearer
// wrong-pitch slot steal the match away from a same-pitch slot that is
// merely a little further off but still in window, misgrading a correct
// note as wrong and permanently orphaning the slot it should have matched.
// Once a slot resolves it is never reconsidered, which is what keeps
// matching monotonic (TS-U-MAT-013): a late note cannot reach back past an
// already-resolved slot.
//
// "Now" always comes from the injected clock, never a wall-clock read here
// (ADR-005/ADR-006) — the caller wires `now`/`ticksToSeconds` to MasterClock.
// Expected notes that are never played are not reported by this class at
// all: `Matcher.consume()` returns one result per call, so there is no slot
// to carry a proactive `missed`. The session layer reconciles leftovers into
// `missed` once the attempt ends (see `core/grade/reconcileMissed.ts`).

import type { MidiPitch } from '../midi/decode';
import type { Seconds, Ticks } from '../time/types';
import {
  VELOCITY_FLOOR,
  type ExpectedNote,
  type MatchResult,
  type Matcher,
  type MatcherState,
} from './types';
import { windowFor } from './tolerance';

export interface TimedMatcherClock {
  now(): Seconds;
  ticksToSeconds(ticks: Ticks): Seconds;
}

interface Slot {
  id: string;
  pitch: MidiPitch;
  groupId: string;
  expectedSeconds: Seconds;
  resolved: boolean;
}

export class TimedMatcher implements Matcher {
  private slots: Slot[] = [];
  private furthestResolvedIndex = -1;
  private readonly windowSeconds: number; // 2x loose, scaled — the outer search radius

  constructor(
    private readonly clock: TimedMatcherClock,
    private readonly bpm: number,
    private readonly toleranceScale: number,
  ) {
    this.windowSeconds = (2 * windowFor('loose', this.bpm) * this.toleranceScale) / 1000;
  }

  expect(events: ExpectedNote[]): void {
    this.slots = [...events]
      .sort((a, b) => (a.atTick as number) - (b.atTick as number))
      .map((e) => ({
        id: e.id,
        pitch: e.pitch,
        groupId: e.groupId,
        expectedSeconds: this.clock.ticksToSeconds(e.atTick),
        resolved: false,
      }));
    this.furthestResolvedIndex = -1;
  }

  consume(e: { pitch: MidiPitch; velocity: number }): MatchResult {
    if (e.velocity < VELOCITY_FLOOR) return { kind: 'ignored' };

    const now = this.clock.now();
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let i = this.furthestResolvedIndex + 1; i < this.slots.length; i++) {
      const slot = this.slots[i]!;
      if (slot.resolved || slot.pitch !== e.pitch) continue;
      const distance = Math.abs((now as number) - (slot.expectedSeconds as number));
      if (distance > this.windowSeconds) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return { kind: 'extra', pitch: e.pitch };

    const slot = this.slots[bestIndex]!;
    slot.resolved = true;
    this.furthestResolvedIndex = bestIndex;
    const deltaMs = ((now as number) - (slot.expectedSeconds as number)) * 1000;
    return { kind: 'correct', expectedId: slot.id, deltaMs };
  }

  state(): MatcherState {
    const now = this.clock.now();
    const groupIds = [...new Set(this.slots.map((s) => s.groupId))];
    const currentGroupId = this.slots.find((s) => !s.resolved)?.groupId;
    const pending = currentGroupId
      ? this.slots.filter((s) => s.groupId === currentGroupId && !s.resolved).map((s) => s.pitch)
      : [];
    const complete = this.slots.every(
      (s) => s.resolved || (now as number) - (s.expectedSeconds as number) > this.windowSeconds,
    );
    return {
      groupIndex: currentGroupId ? groupIds.indexOf(currentGroupId) : groupIds.length,
      totalGroups: groupIds.length,
      pending,
      complete,
    };
  }

  reset(): void {
    this.furthestResolvedIndex = -1;
    for (const slot of this.slots) slot.resolved = false;
  }
}
