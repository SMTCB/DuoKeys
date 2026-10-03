import { describe, expect, it } from 'vitest';
import { asMidiPitch } from '../midi/decode';
import { midiPitchToNoteName, noteNameToMidiPitch } from './noteName';

describe('noteNameToMidiPitch', () => {
  it('resolves middle C (C4) to MIDI 60', () => {
    expect(noteNameToMidiPitch('C4')).toBe(60);
  });

  it('resolves sharps and flats to the same pitch class a semitone apart', () => {
    expect(noteNameToMidiPitch('C#4')).toBe(61);
    expect(noteNameToMidiPitch('Db4')).toBe(61);
  });

  it('resolves notes above and below middle C by octave', () => {
    expect(noteNameToMidiPitch('G4')).toBe(67);
    expect(noteNameToMidiPitch('C5')).toBe(72);
    expect(noteNameToMidiPitch('C3')).toBe(48);
  });

  it('resolves the lowest MIDI octave', () => {
    expect(noteNameToMidiPitch('C-1')).toBe(0);
  });

  it('throws on malformed input', () => {
    expect(() => noteNameToMidiPitch('H4')).toThrow();
    expect(() => noteNameToMidiPitch('C')).toThrow();
    expect(() => noteNameToMidiPitch('')).toThrow();
  });
});

describe('midiPitchToNoteName', () => {
  it('is the inverse of noteNameToMidiPitch for natural notes', () => {
    expect(midiPitchToNoteName(asMidiPitch(60))).toBe('C4');
    expect(midiPitchToNoteName(asMidiPitch(67))).toBe('G4');
    expect(midiPitchToNoteName(asMidiPitch(0))).toBe('C-1');
  });

  it('names sharps with a # (never flats)', () => {
    expect(midiPitchToNoteName(asMidiPitch(61))).toBe('C#4');
  });
});
