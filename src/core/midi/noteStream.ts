// TA-MID-001 — pairs note-on/note-off into a NoteEvent with duration.
//
//   WebMidiBackend
//     -> decode        raw bytes -> typed MidiEvent (TA-MID-002)
//     -> latencyShift  subtract Profile.latencyOffsetMs (TA-CLK-004)
//     -> pedalTracker   apply CC64 sustain semantics (TA-MID-004)
//     -> noteStream     pair note-on/note-off into NoteEvent with duration  <- this file
//     -> PerformanceEvent stream -> matcher (TA-MAT-*) + renderer (TA-REN-*)

import type { MidiPitch } from './decode';
import type { Millis } from '../time/types';

export interface NoteEvent {
  pitch: MidiPitch;
  startTimeStamp: Millis;
  durationMs: number;
  velocity: number;
}

export class NoteStreamTracker {
  private readonly openNotes = new Map<MidiPitch, { startTimeStamp: Millis; velocity: number }>();

  /**
   * TS-U-MID-011: a second note-on for a still-open pitch closes the first note
   * (returned) before opening the new one.
   */
  noteOn(pitch: MidiPitch, velocity: number, timeStamp: Millis): NoteEvent | undefined {
    const existing = this.openNotes.get(pitch);
    const closed = existing ? this.close(pitch, existing, timeStamp) : undefined;
    this.openNotes.set(pitch, { startTimeStamp: timeStamp, velocity });
    return closed;
  }

  /** TS-U-MID-010: a note-off with no matching note-on is ignored, not an error. */
  noteOff(pitch: MidiPitch, timeStamp: Millis): NoteEvent | undefined {
    const existing = this.openNotes.get(pitch);
    if (!existing) return undefined;
    this.openNotes.delete(pitch);
    return this.close(pitch, existing, timeStamp);
  }

  private close(
    pitch: MidiPitch,
    open: { startTimeStamp: Millis; velocity: number },
    timeStamp: Millis,
  ): NoteEvent {
    return {
      pitch,
      startTimeStamp: open.startTimeStamp,
      durationMs: (timeStamp as number) - (open.startTimeStamp as number),
      velocity: open.velocity,
    };
  }
}
