import { describe, expect, it } from 'vitest';
import { MidiDecoder, shiftTimestamp } from './decode';
import { asMillis } from '../time/types';

describe('MidiDecoder', () => {
  // TS-U-MID-001
  it('decodes note on', () => {
    const decoder = new MidiDecoder();
    const event = decoder.decode(new Uint8Array([0x90, 0x3c, 0x64]), asMillis(0));
    expect(event).toEqual({ kind: 'noteOn', pitch: 60, velocity: 100, timeStamp: 0 });
  });

  // TS-U-MID-002
  it('decodes note off', () => {
    const decoder = new MidiDecoder();
    const event = decoder.decode(new Uint8Array([0x80, 0x3c, 0x40]), asMillis(0));
    expect(event).toEqual({ kind: 'noteOff', pitch: 60, timeStamp: 0 });
  });

  // TS-U-MID-003
  it('treats velocity-0 note-on as note-off', () => {
    const decoder = new MidiDecoder();
    const event = decoder.decode(new Uint8Array([0x90, 0x3c, 0x00]), asMillis(0));
    expect(event).toEqual({ kind: 'noteOff', pitch: 60, timeStamp: 0 });
  });

  // TS-U-MID-004
  it('swallows active sensing entirely', () => {
    const decoder = new MidiDecoder();
    let emitted = 0;
    for (let i = 0; i < 100; i++) {
      const event = decoder.decode(new Uint8Array([0xfe]), asMillis(i));
      if (event) emitted++;
    }
    expect(emitted).toBe(0);
  });

  // TS-U-MID-006
  it('handles a running-status stream', () => {
    const decoder = new MidiDecoder();
    const first = decoder.decode(new Uint8Array([0x90, 0x3c, 0x64]), asMillis(0));
    const second = decoder.decode(new Uint8Array([0x40, 0x50]), asMillis(10)); // running status, pitch 64
    const third = decoder.decode(new Uint8Array([0x3c, 0x00]), asMillis(20)); // running status note-off (vel 0)
    expect(first).toEqual({ kind: 'noteOn', pitch: 60, velocity: 100, timeStamp: 0 });
    expect(second).toEqual({ kind: 'noteOn', pitch: 64, velocity: 80, timeStamp: 10 });
    expect(third).toEqual({ kind: 'noteOff', pitch: 60, timeStamp: 20 });
  });

  // TS-U-MID-007
  it('ignores an unhandled status byte without crashing', () => {
    const decoder = new MidiDecoder();
    expect(() => decoder.decode(new Uint8Array([0xf0, 0x7e, 0x00, 0xf7]), asMillis(0))).not.toThrow();
    const event = decoder.decode(new Uint8Array([0xf0, 0x7e, 0x00, 0xf7]), asMillis(0));
    expect(event).toBeUndefined();
  });

  // TS-U-MID-008
  it('shifts the timestamp by the latency offset', () => {
    const decoder = new MidiDecoder();
    const event = decoder.decode(new Uint8Array([0x90, 0x3c, 0x64]), asMillis(1000))!;
    const shifted = shiftTimestamp(event, asMillis(30));
    expect(shifted.timeStamp).toBe(970);
  });

  it('decodes CC64', () => {
    const decoder = new MidiDecoder();
    const event = decoder.decode(new Uint8Array([0xb0, 0x40, 0x7f]), asMillis(0));
    expect(event).toEqual({ kind: 'controlChange', controller: 64, value: 127, timeStamp: 0 });
  });
});
