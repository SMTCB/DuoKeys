// FR-STU-015 — Standard MIDI File (.mid) reader. Pure: bytes in, notes out.
//
// decode.ts reads live Web MIDI messages; this reads the file container
// (MThd / MTrk chunks, delta times, running status, meta events). It keeps only
// what a piano learning app needs: notes with their start and length in ticks,
// the tempo map and the time signature. Everything else in a file (lyrics,
// controllers, program changes, sysex) is skipped without being interpreted.

import { asMidiPitch, type MidiPitch } from './decode';
import { asTicks, type Ticks } from '../time/types';

export interface SmfNote {
  pitch: MidiPitch;
  startTick: Ticks;
  durationTicks: Ticks;
  velocity: number; // 1-127
  channel: number; // 0-15
  trackIndex: number;
}

export interface SmfTempoChange {
  tick: Ticks;
  microsecondsPerQuarter: number;
}

export interface SmfFile {
  format: 0 | 1 | 2;
  ticksPerQuarter: number;
  notes: SmfNote[]; // sorted by startTick, then pitch
  tempoChanges: SmfTempoChange[]; // sorted by tick; always starts at tick 0
  timeSignature: { numerator: number; denominator: number };
  trackNames: string[]; // one per track, '' when unnamed
  totalTicks: Ticks;
}

export type SmfParseResult = { ok: true; file: SmfFile } | { ok: false; error: string };

const DEFAULT_TEMPO = 500_000; // 120 bpm, the SMF default

class Reader {
  pos = 0;
  constructor(readonly bytes: Uint8Array) {}
  get remaining(): number {
    return this.bytes.length - this.pos;
  }
  u8(): number {
    if (this.pos >= this.bytes.length) throw new Error('Unexpected end of file');
    return this.bytes[this.pos++]!;
  }
  u16(): number {
    return (this.u8() << 8) | this.u8();
  }
  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }
  varLen(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      value = (value << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) return value;
    }
    throw new Error('Bad variable-length number');
  }
  ascii(length: number): string {
    let s = '';
    for (let i = 0; i < length; i++) s += String.fromCharCode(this.u8());
    return s;
  }
  skip(length: number): void {
    if (length > this.remaining) throw new Error('Unexpected end of file');
    this.pos += length;
  }
}

interface OpenNote {
  startTick: number;
  velocity: number;
}

interface TrackSink {
  notes: SmfNote[];
  tempos: SmfTempoChange[];
  timeSignature: SmfFile['timeSignature'] | null;
  name: string;
  lastTick: number;
}

function readTrack(reader: Reader, end: number, trackIndex: number, out: TrackSink): void {
  let tick = 0;
  let runningStatus = 0;
  const open = new Map<number, OpenNote>(); // channel * 128 + pitch -> the note-on waiting for its off

  const close = (channel: number, pitch: number, atTick: number): void => {
    const key = channel * 128 + pitch;
    const started = open.get(key);
    if (!started) return;
    open.delete(key);
    out.notes.push({
      pitch: asMidiPitch(pitch),
      startTick: asTicks(started.startTick),
      durationTicks: asTicks(Math.max(1, atTick - started.startTick)),
      velocity: started.velocity,
      channel,
      trackIndex,
    });
  };

  while (reader.pos < end) {
    tick += reader.varLen();
    let status = reader.u8();
    if (status < 0x80) {
      // Running status: this byte is the first data byte of the previous status.
      if (runningStatus === 0) throw new Error('Data byte without a status');
      reader.pos -= 1;
      status = runningStatus;
    }

    if (status === 0xff) {
      const type = reader.u8();
      const length = reader.varLen();
      if (type === 0x51 && length === 3) {
        out.tempos.push({ tick: asTicks(tick), microsecondsPerQuarter: (reader.u8() << 16) | (reader.u8() << 8) | reader.u8() });
      } else if (type === 0x58 && length >= 2) {
        const numerator = reader.u8();
        const denominator = 2 ** reader.u8();
        reader.skip(length - 2);
        out.timeSignature ??= { numerator, denominator };
      } else if (type === 0x03 && out.name === '') {
        out.name = reader.ascii(length).trim();
      } else if (type === 0x2f) {
        reader.skip(length);
        break;
      } else {
        reader.skip(length);
      }
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      reader.skip(reader.varLen());
      continue;
    }

    runningStatus = status;
    const kind = status & 0xf0;
    const channel = status & 0x0f;
    if (kind === 0xc0 || kind === 0xd0) {
      reader.u8();
    } else if (kind === 0x90) {
      const pitch = reader.u8();
      const velocity = reader.u8();
      if (velocity === 0) close(channel, pitch, tick);
      else {
        close(channel, pitch, tick); // a repeated note-on ends the one still sounding
        open.set(channel * 128 + pitch, { startTick: tick, velocity });
      }
    } else if (kind === 0x80) {
      const pitch = reader.u8();
      reader.u8();
      close(channel, pitch, tick);
    } else if (kind === 0xa0 || kind === 0xb0 || kind === 0xe0) {
      reader.u8();
      reader.u8();
    } else {
      throw new Error(`Unknown event 0x${status.toString(16)}`);
    }
  }
  for (const key of [...open.keys()]) close(Math.floor(key / 128), key % 128, tick); // notes never switched off
  out.lastTick = Math.max(out.lastTick, tick);
}

/** Parses the bytes of a .mid file. Returns an error message instead of throwing on malformed input. */
export function parseSmf(bytes: Uint8Array): SmfParseResult {
  try {
    const reader = new Reader(bytes);
    if (reader.ascii(4) !== 'MThd') return { ok: false, error: 'Not a MIDI file' };
    const headerLength = reader.u32();
    const format = reader.u16();
    const trackCount = reader.u16();
    const division = reader.u16();
    reader.skip(Math.max(0, headerLength - 6));
    if (format > 2) return { ok: false, error: `Unsupported MIDI file format ${format}` };
    if (division & 0x8000) return { ok: false, error: 'SMPTE-timed MIDI files are not supported' };
    if (division === 0) return { ok: false, error: 'MIDI file has no time division' };

    const notes: SmfNote[] = [];
    const tempos: SmfTempoChange[] = [];
    const trackNames: string[] = [];
    let timeSignature: SmfFile['timeSignature'] | null = null;
    let lastTick = 0;

    for (let t = 0; t < trackCount && reader.remaining >= 8; t++) {
      const id = reader.ascii(4);
      const length = reader.u32();
      const end = Math.min(reader.pos + length, bytes.length);
      if (id !== 'MTrk') {
        reader.pos = end;
        trackNames.push('');
        continue;
      }
      const sink: TrackSink = { notes, tempos, timeSignature, name: '', lastTick };
      readTrack(reader, end, t, sink);
      timeSignature = sink.timeSignature;
      lastTick = sink.lastTick;
      trackNames.push(sink.name);
      reader.pos = end;
    }

    notes.sort((a, b) => (a.startTick as number) - (b.startTick as number) || (a.pitch as number) - (b.pitch as number));
    tempos.sort((a, b) => (a.tick as number) - (b.tick as number));
    if (tempos.length === 0 || (tempos[0]!.tick as number) > 0) {
      tempos.unshift({ tick: asTicks(0), microsecondsPerQuarter: tempos[0]?.microsecondsPerQuarter ?? DEFAULT_TEMPO });
    }
    const lastNoteEnd = notes.reduce((m, n) => Math.max(m, (n.startTick as number) + (n.durationTicks as number)), 0);

    return {
      ok: true,
      file: {
        format: format as 0 | 1 | 2,
        ticksPerQuarter: division,
        notes,
        tempoChanges: tempos,
        timeSignature: timeSignature ?? { numerator: 4, denominator: 4 },
        trackNames,
        totalTicks: asTicks(Math.max(lastTick, lastNoteEnd)),
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
