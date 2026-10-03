import { describe, expect, it } from 'vitest';
import { ChordMatcher } from './chordMatcher';
import { asMidiPitch } from '../midi/decode';

function noteOn(pitch: number, timeStamp: number, velocity = 80) {
  return { pitch: asMidiPitch(pitch), velocity, timeStamp };
}

describe('ChordMatcher', () => {
  it('ignores notes below the velocity floor (TA-MAT-005)', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    expect(m.consume(noteOn(60, 0, 5))).toEqual({ kind: 'ignored' });
  });

  it('reports partial while pitch classes are still missing', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]); // C E G
    const result = m.consume(noteOn(60, 0));
    expect(result.kind).toBe('partial');
    if (result.kind === 'partial') {
      expect([...result.missing].sort()).toEqual([4, 7]);
    }
  });

  it('completes once the played set covers the target set, regardless of order', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    m.consume(noteOn(67, 0));
    m.consume(noteOn(60, 10));
    expect(m.consume(noteOn(64, 20))).toEqual({ kind: 'complete' });
  });

  it('is octave-invariant — any octave of a target pitch class counts', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]); // C4 E4 G4
    m.consume(noteOn(48, 0)); // C3
    m.consume(noteOn(76, 10)); // E5
    expect(m.consume(noteOn(79, 20))).toEqual({ kind: 'complete' }); // G5
  });

  it('extra non-target notes do not block completion', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    m.consume(noteOn(60, 0));
    m.consume(noteOn(62, 5)); // extra, not in target
    m.consume(noteOn(64, 10));
    expect(m.consume(noteOn(67, 15))).toEqual({ kind: 'complete' });
  });

  it('starts a fresh strike after a gap past the co-incidence window, discarding prior partial progress', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    m.consume(noteOn(60, 0));
    m.consume(noteOn(64, 100)); // within 150ms of batch start — same strike
    const late = m.consume(noteOn(67, 400)); // > 150ms past batch start — new strike, drops C and E
    expect(late).toEqual({ kind: 'partial', missing: expect.arrayContaining([0, 4]) });
  });

  it('setTarget resets played notes and batch state', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    m.consume(noteOn(60, 0));
    m.setTarget([asMidiPitch(65), asMidiPitch(69), asMidiPitch(72)]); // F A C
    expect(m.state()).toEqual({ target: [5, 9, 0], played: [], complete: false });
  });

  it('reset() clears played notes without changing the target', () => {
    const m = new ChordMatcher();
    m.setTarget([asMidiPitch(60), asMidiPitch(64), asMidiPitch(67)]);
    m.consume(noteOn(60, 0));
    m.reset();
    expect(m.state().played).toEqual([]);
    expect(m.state().target).toEqual([0, 4, 7]);
  });
});
