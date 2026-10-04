// TA-MAT-002 — WaitMatcher: the default, and for months the only, mode.
//
// The stream freezes at the hit line until the expected chord-set (TA-MAT-004's
// groupId) is fully satisfied. No timing judgement at all — only pitch. No
// timeouts: a six-year-old may take thirty seconds to find F# and that is fine
// (FR-EXP-003 — there is no failure state for the child).

import type { MidiPitch } from '../midi/decode';
import {
  VELOCITY_FLOOR,
  type ExpectedNote,
  type MatchResult,
  type Matcher,
  type MatcherState,
} from './types';

interface Group {
  groupId: string;
  expectedIds: Map<MidiPitch, string>;
}

export interface WaitMatcherOptions {
  /** Any octave of a wanted note counts (a chord drill, not a song). Default: the exact pitch is required. */
  anyOctave?: boolean;
}

export class WaitMatcher implements Matcher {
  constructor(private readonly options: WaitMatcherOptions = {}) {}

  private groups: Group[] = [];
  private pending: Set<MidiPitch>[] = [];
  private groupIndex = 0;

  expect(events: ExpectedNote[]): void {
    const groups: Group[] = [];
    for (const event of events) {
      let group = groups.find((g) => g.groupId === event.groupId);
      if (!group) {
        group = { groupId: event.groupId, expectedIds: new Map() };
        groups.push(group);
      }
      group.expectedIds.set(event.pitch, event.id);
    }
    this.groups = groups;
    this.rebuildPending();
    this.groupIndex = 0;
  }

  consume(e: { pitch: MidiPitch; velocity: number }): MatchResult {
    if (e.velocity < VELOCITY_FLOOR) return { kind: 'ignored' };
    if (this.groupIndex >= this.groups.length) return { kind: 'extra', pitch: e.pitch };

    const currentGroup = this.groups[this.groupIndex]!;
    const currentPending = this.pending[this.groupIndex]!;

    const wantedPitch = this.options.anyOctave ? nearestWantedPitch(currentPending, e.pitch) : currentPending.has(e.pitch) ? e.pitch : undefined;
    if (wantedPitch === undefined) {
      // TS-U-MAT-006: reported, but never blocks advancement.
      return { kind: 'extra', pitch: e.pitch };
    }

    const expectedId = currentGroup.expectedIds.get(wantedPitch)!;
    currentPending.delete(wantedPitch);
    if (currentPending.size === 0) {
      this.groupIndex++;
    }
    return { kind: 'correct', expectedId, deltaMs: 0 };
  }

  state(): MatcherState {
    const pending = this.pending[this.groupIndex];
    return {
      groupIndex: this.groupIndex,
      totalGroups: this.groups.length,
      pending: pending ? [...pending] : [],
      complete: this.groupIndex >= this.groups.length,
    };
  }

  reset(): void {
    this.groupIndex = 0;
    this.rebuildPending();
  }

  private rebuildPending(): void {
    this.pending = this.groups.map((g) => new Set(g.expectedIds.keys()));
  }
}

/** The still-wanted pitch with the same pitch class as `played`, nearest to it (exact pitch wins). */
function nearestWantedPitch(pending: ReadonlySet<MidiPitch>, played: MidiPitch): MidiPitch | undefined {
  let best: MidiPitch | undefined;
  for (const wanted of pending) {
    if (((wanted as number) - (played as number)) % 12 !== 0) continue;
    if (best === undefined || Math.abs((wanted as number) - (played as number)) < Math.abs((best as number) - (played as number))) best = wanted;
  }
  return best;
}
