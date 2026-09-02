// TA-PORT-004 — deterministic fake AudioBackend. Records every call instead
// of touching the Web Audio API, and its `now()` is the master clock so
// MasterClock can be driven entirely from test code.

import type { AudioBackend, SampleId, VoiceHandle } from '../ports';
import type { MidiPitch } from '../../core/midi/decode';
import type { Seconds } from '../../core/time/types';
import { FakeClock } from './fakeClock';

export interface RecordedNote {
  pitch: MidiPitch;
  velocity: number;
  at: Seconds;
}

export interface RecordedStop {
  handle: VoiceHandle;
  at: Seconds;
}

export interface RecordedSample {
  id: SampleId;
  at: Seconds;
}

export class FakeAudioBackend implements AudioBackend {
  private readonly clock = new FakeClock();
  private nextVoiceId = 0;
  masterGain = 1;

  readonly notesPlayed: RecordedNote[] = [];
  readonly notesStopped: RecordedStop[] = [];
  readonly samplesPlayed: RecordedSample[] = [];

  now(): Seconds {
    return this.clock.now();
  }

  advanceClock(seconds: number): void {
    this.clock.advance(seconds);
  }

  playNote(pitch: MidiPitch, velocity: number, at?: Seconds): VoiceHandle {
    const handle: VoiceHandle = { id: this.nextVoiceId++ };
    this.notesPlayed.push({ pitch, velocity, at: at ?? this.now() });
    return handle;
  }

  stopNote(h: VoiceHandle, at?: Seconds): void {
    this.notesStopped.push({ handle: h, at: at ?? this.now() });
  }

  playSample(id: SampleId, at?: Seconds): void {
    this.samplesPlayed.push({ id, at: at ?? this.now() });
  }

  setMasterGain(g: number): void {
    this.masterGain = g;
  }

  async resume(): Promise<void> {
    // no-op — nothing to unlock in a fake
  }
}
