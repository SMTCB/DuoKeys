// TA-PORT-004 — FakeMidiBackend replays a PerformanceFixture against a
// FakeClock. This is the mechanism behind the TS-U-*/TS-I-* suite: advance
// the clock, call pump(), and any due fixture events fire onMessage.

import type {
  MidiBackend,
  MidiConnectionState,
  MidiInputInfo,
  RawMidiMessage,
  Unsubscribe,
} from '../ports';
import { asMillis } from '../../core/time/types';
import type { FakeClock } from './fakeClock';

export interface FixtureEvent {
  atSeconds: number;
  data: readonly number[]; // raw MIDI bytes, e.g. [0x90, 60, 80]
}

export type PerformanceFixture = readonly FixtureEvent[];

export class FakeMidiBackend implements MidiBackend {
  private readonly messageCbs = new Set<(msg: RawMidiMessage) => void>();
  private readonly stateCbs = new Set<(s: MidiConnectionState) => void>();
  private opened = false;
  private fixture: PerformanceFixture = [];
  private nextIndex = 0;

  constructor(private readonly clock: Pick<FakeClock, 'now'>) {}

  async listInputs(): Promise<MidiInputInfo[]> {
    return [{ id: 'fake-piano', name: 'Fake Piano', manufacturer: 'DuoKeys' }];
  }

  async open(_id: string): Promise<void> {
    this.opened = true;
    this.stateCbs.forEach((cb) => cb('connected'));
  }

  async close(): Promise<void> {
    this.opened = false;
    this.stateCbs.forEach((cb) => cb('disconnected'));
  }

  onMessage(cb: (msg: RawMidiMessage) => void): Unsubscribe {
    this.messageCbs.add(cb);
    return () => this.messageCbs.delete(cb);
  }

  onStateChange(cb: (s: MidiConnectionState) => void): Unsubscribe {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  loadFixture(fixture: PerformanceFixture): void {
    this.fixture = [...fixture].sort((a, b) => a.atSeconds - b.atSeconds);
    this.nextIndex = 0;
  }

  /** Emits any fixture events at or before the clock's current time. */
  pump(): void {
    if (!this.opened) return;
    const now = this.clock.now() as number;
    while (this.nextIndex < this.fixture.length) {
      const evt = this.fixture[this.nextIndex];
      if (!evt || evt.atSeconds > now) break;
      this.nextIndex++;
      const msg: RawMidiMessage = {
        data: new Uint8Array(evt.data),
        timeStamp: asMillis(evt.atSeconds * 1000),
      };
      this.messageCbs.forEach((cb) => cb(msg));
    }
  }
}
