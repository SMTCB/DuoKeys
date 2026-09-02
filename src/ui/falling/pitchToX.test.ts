import { describe, expect, it } from 'vitest';
import { asMidiPitch } from '../../core/midi/decode';
import { BLACK_KEY_WIDTH_UNITS, pitchToX, type KeyboardRange } from './pitchToX';

const RANGE: KeyboardRange = { low: asMidiPitch(21), high: asMidiPitch(108) };

describe('pitchToX (TS-U-REN)', () => {
  it('TS-U-REN-001: the low bound of the range sits at x=0', () => {
    expect(pitchToX(RANGE.low, RANGE).x).toBe(0);
  });

  it('TS-U-REN-002: white keys tile uniformly — each successive white key is exactly 1 unit right of the last', () => {
    // C4 D4 E4 F4 G4 A4 B4 — all white, consecutive
    const whites = [60, 62, 64, 65, 67, 69, 71].map((p) => pitchToX(asMidiPitch(p), RANGE));
    for (let i = 1; i < whites.length; i++) {
      expect(whites[i]!.x - whites[i - 1]!.x).toBeCloseTo(1, 6);
    }
    for (const w of whites) {
      expect(w.isWhite).toBe(true);
      expect(w.widthUnits).toBe(1);
    }
  });

  it('TS-U-REN-003: black keys are inset — never aligned to a white key\'s integer x', () => {
    const blacks = [61, 63, 66, 68, 70].map((p) => pitchToX(asMidiPitch(p), RANGE));
    for (const b of blacks) {
      expect(b.isWhite).toBe(false);
      expect(b.widthUnits).toBe(BLACK_KEY_WIDTH_UNITS);
      expect(Number.isInteger(b.x)).toBe(false);
    }
  });

  it('TS-U-REN-004: black keys sit strictly between the white keys on either side of them', () => {
    const cSharp = pitchToX(asMidiPitch(61), RANGE); // between C(60) and D(62)
    const c = pitchToX(asMidiPitch(60), RANGE);
    const d = pitchToX(asMidiPitch(62), RANGE);
    expect(cSharp.x).toBeGreaterThan(c.x);
    expect(cSharp.x).toBeLessThan(d.x);
  });

  it('TS-U-REN-005: the pattern repeats every octave — same pitch class is 7 white-key-units further per octave', () => {
    const c4 = pitchToX(asMidiPitch(60), RANGE);
    const c5 = pitchToX(asMidiPitch(72), RANGE);
    expect(c5.x - c4.x).toBeCloseTo(7, 6);

    const fSharp4 = pitchToX(asMidiPitch(66), RANGE);
    const fSharp5 = pitchToX(asMidiPitch(78), RANGE);
    expect(fSharp5.x - fSharp4.x).toBeCloseTo(7, 6);
  });

  it('TS-U-REN-006: a smaller keyboardRange re-derives x from its own low bound (61-key safety net, ADR-009)', () => {
    const smallRange: KeyboardRange = { low: asMidiPitch(36), high: asMidiPitch(96) };
    expect(pitchToX(asMidiPitch(36), smallRange).x).toBe(0);
    expect(pitchToX(asMidiPitch(36), RANGE).x).not.toBe(0);
  });
});
