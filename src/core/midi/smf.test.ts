import { describe, expect, it } from 'vitest';
import { parseSmf } from './smf';

const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number): number[] => [(n >>> 8) & 255, n & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

function smf(tracks: number[][], division = 480, format = 1): Uint8Array {
  const out = [...ascii('MThd'), ...be32(6), ...be16(format), ...be16(tracks.length), ...be16(division)];
  for (const t of tracks) out.push(...ascii('MTrk'), ...be32(t.length), ...t);
  return new Uint8Array(out);
}

const END = [0x00, 0xff, 0x2f, 0x00];

describe('parseSmf', () => {
  it('reads notes with start, length, velocity and channel', () => {
    const track = [0x00, 0x90, 60, 100, 0x81, 0x70, 0x80, 60, 0, 0x00, 0x90, 64, 80, 0x60, 0x80, 64, 0, ...END];
    const result = parseSmf(smf([track]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.ticksPerQuarter).toBe(480);
    expect(result.file.notes).toHaveLength(2);
    const [first, second] = result.file.notes;
    expect(first).toMatchObject({ pitch: 60, startTick: 0, durationTicks: 240, velocity: 100, channel: 0 });
    expect(second).toMatchObject({ pitch: 64, startTick: 240, durationTicks: 96, velocity: 80 });
  });

  it('honours running status and note-on with velocity 0 as note-off', () => {
    const track = [0x00, 0x90, 60, 90, 0x10, 62, 90, 0x10, 60, 0, 0x10, 62, 0, ...END];
    const result = parseSmf(smf([track]));
    if (!result.ok) throw new Error(result.error);
    expect(result.file.notes.map((n) => [n.pitch, n.startTick, n.durationTicks])).toEqual([
      [60, 0, 32],
      [62, 16, 32],
    ]);
  });

  it('reads tempo, time signature and track names, defaulting tempo at tick 0', () => {
    const named = [0x00, 0xff, 0x03, 0x05, ...ascii('Piano'), 0x00, 0xff, 0x58, 0x04, 3, 2, 24, 8, ...END];
    const tempo = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, ...END]; // 500 000 µs
    const result = parseSmf(smf([named, tempo]));
    if (!result.ok) throw new Error(result.error);
    expect(result.file.timeSignature).toEqual({ numerator: 3, denominator: 4 });
    expect(result.file.trackNames).toEqual(['Piano', '']);
    expect(result.file.tempoChanges).toEqual([{ tick: 0, microsecondsPerQuarter: 500_000 }]);
    const none = parseSmf(smf([END]));
    if (!none.ok) throw new Error(none.error);
    expect(none.file.tempoChanges[0]?.microsecondsPerQuarter).toBe(500_000);
  });

  it('skips sysex and controller events, and closes notes never switched off', () => {
    const track = [0x00, 0xf0, 0x03, 1, 2, 0xf7, 0x00, 0xb0, 7, 100, 0x00, 0xc0, 5, 0x00, 0x91, 72, 64, 0x20, 0xff, 0x01, 0x01, 0x41, ...END];
    const result = parseSmf(smf([track]));
    if (!result.ok) throw new Error(result.error);
    expect(result.file.notes).toHaveLength(1);
    expect(result.file.notes[0]).toMatchObject({ pitch: 72, channel: 1 });
    expect(result.file.totalTicks).toBeGreaterThan(0);
  });

  it('reports malformed input instead of throwing', () => {
    expect(parseSmf(new Uint8Array([1, 2, 3])).ok).toBe(false);
    expect(parseSmf(new Uint8Array(ascii('RIFFxxxx'))).ok).toBe(false);
    const truncated = smf([[0x00, 0x90, 60]]);
    expect(parseSmf(truncated).ok).toBe(false);
    const smpte = new Uint8Array([...ascii('MThd'), ...be32(6), ...be16(0), ...be16(0), 0xe7, 0x28]);
    expect(parseSmf(smpte).ok).toBe(false);
  });
});
