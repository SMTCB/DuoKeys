// TA-MID-002 — raw MIDI bytes to typed MidiEvent.
//
// Handles Note On (0x90), Note Off (0x80), Note-On-velocity-0-as-Note-Off,
// CC64/66/67, running status, and silently swallows Active Sensing (0xFE) and
// anything else unhandled (TS-U-MID-007).

import type { Millis } from '../time/types';
import { asMillis } from '../time/types';

export type MidiPitch = number & { readonly __brand: 'MidiPitch' };
export const asMidiPitch = (n: number): MidiPitch => n as MidiPitch;

export interface NoteOnEvent {
  kind: 'noteOn';
  pitch: MidiPitch;
  velocity: number;
  timeStamp: Millis;
}

export interface NoteOffEvent {
  kind: 'noteOff';
  pitch: MidiPitch;
  timeStamp: Millis;
}

export interface ControlChangeEvent {
  kind: 'controlChange';
  controller: number;
  value: number;
  timeStamp: Millis;
}

export type MidiEvent = NoteOnEvent | NoteOffEvent | ControlChangeEvent;

const STATUS_NOTE_OFF = 0x80;
const STATUS_NOTE_ON = 0x90;
const STATUS_CONTROL_CHANGE = 0xb0;
const ACTIVE_SENSING = 0xfe;

/** Stateful only for running-status tracking — the decode itself is pure per call. */
export class MidiDecoder {
  private runningStatus: number | undefined;

  decode(data: Uint8Array, timeStamp: Millis): MidiEvent | undefined {
    if (data.length === 0) return undefined;

    const first = data[0]!;
    let status: number;
    let offset: number;

    if (first < 0x80) {
      // TS-U-MID-006: running status — no status byte on this message, reuse the last one.
      if (this.runningStatus === undefined) return undefined;
      status = this.runningStatus;
      offset = 0;
    } else {
      status = first;
      offset = 1;
      if (status < 0xf0) this.runningStatus = status; // only channel messages carry running status
    }

    if (status === ACTIVE_SENSING) return undefined;

    const type = status & 0xf0;
    const d1 = data[offset];
    const d2 = data[offset + 1];

    switch (type) {
      case STATUS_NOTE_ON: {
        if (d1 === undefined || d2 === undefined) return undefined;
        if (d2 === 0) {
          // TS-U-MID-003: velocity-0 note-on is a note-off, not a note-on.
          return { kind: 'noteOff', pitch: asMidiPitch(d1), timeStamp };
        }
        return { kind: 'noteOn', pitch: asMidiPitch(d1), velocity: d2, timeStamp };
      }
      case STATUS_NOTE_OFF: {
        if (d1 === undefined) return undefined;
        return { kind: 'noteOff', pitch: asMidiPitch(d1), timeStamp };
      }
      case STATUS_CONTROL_CHANGE: {
        if (d1 === undefined || d2 === undefined) return undefined;
        return { kind: 'controlChange', controller: d1, value: d2, timeStamp };
      }
      default:
        // TS-U-MID-007: unknown/unhandled status — no crash, no event.
        return undefined;
    }
  }

  reset(): void {
    this.runningStatus = undefined;
  }
}

/** TS-U-MID-008 — subtract the calibrated latency offset before anything downstream sees the event. */
export function shiftTimestamp<T extends MidiEvent>(event: T, latencyOffsetMs: Millis): T {
  return { ...event, timeStamp: asMillis((event.timeStamp as number) - (latencyOffsetMs as number)) };
}
