import { describe, expect, it } from 'vitest';
import { computeGrade, type NoteResult } from './grade';
import { asMidiPitch } from '../midi/decode';

function results(spec: { outcome: NoteResult['outcome']; deltaMs?: number }[]): NoteResult[] {
  return spec.map((s, i) => {
    const base: NoteResult = { pitch: asMidiPitch(60 + i), outcome: s.outcome };
    return s.deltaMs === undefined ? base : { ...base, deltaMs: s.deltaMs };
  });
}

describe('computeGrade', () => {
  // TS-U-GRD-001
  it('perfect performance grades accuracy 1.0, completion 1.0, 3 stars', () => {
    const grade = computeGrade(results(Array(10).fill({ outcome: 'correct' })), 10);
    expect(grade.accuracy).toBe(1);
    expect(grade.completion).toBe(1);
    expect(grade.stars).toBe(3);
  });

  // TS-U-GRD-002
  it('90% accuracy with full completion grades 2 stars', () => {
    const spec = [...Array(9).fill({ outcome: 'correct' }), { outcome: 'wrong' }];
    const grade = computeGrade(results(spec), 10);
    expect(grade.accuracy).toBeCloseTo(0.9);
    expect(grade.completion).toBe(1);
    expect(grade.stars).toBe(2);
  });

  // TS-U-GRD-003
  it('70% completion grades 1 star', () => {
    const spec = [...Array(7).fill({ outcome: 'correct' })]; // 7 of 10 resolved
    const grade = computeGrade(results(spec), 10);
    expect(grade.completion).toBeCloseTo(0.7);
    expect(grade.stars).toBe(1);
  });

  // TS-U-GRD-004
  it('40% completion grades 0 stars', () => {
    const spec = [...Array(4).fill({ outcome: 'correct' })];
    const grade = computeGrade(results(spec), 10);
    expect(grade.completion).toBeCloseTo(0.4);
    expect(grade.stars).toBe(0);
  });

  // TS-U-GRD-005
  it('Explorer floor: a completed attempt with 50% accuracy still yields >= 1 star', () => {
    const spec = [...Array(5).fill({ outcome: 'correct' }), ...Array(5).fill({ outcome: 'wrong' })];
    const grade = computeGrade(results(spec), 10, { explorerFloor: true });
    expect(grade.accuracy).toBeCloseTo(0.5);
    expect(grade.completion).toBe(1);
    expect(grade.stars).toBeGreaterThanOrEqual(1);
  });

  // TS-U-GRD-006
  it('a consistent 40ms-early performance reports a signed rushDragMs of -40', () => {
    const spec = Array(10).fill({ outcome: 'correct', deltaMs: -40 });
    const grade = computeGrade(results(spec), 10);
    expect(grade.rushDragMs).toBeCloseTo(-40);
  });

  // TS-U-GRD-007
  it('alternating +/-40ms averages near zero but keeps a nonzero RMS spread', () => {
    const spec = Array.from({ length: 10 }, (_, i) => ({
      outcome: 'correct' as const,
      deltaMs: i % 2 === 0 ? 40 : -40,
    }));
    const grade = computeGrade(results(spec), 10);
    expect(Math.abs(grade.rushDragMs)).toBeLessThan(5);
    expect(grade.timingRmsMs).toBeCloseTo(40, 0);
  });

  // TS-U-GRD-011
  it('an empty attempt grades 0 without dividing by zero', () => {
    const grade = computeGrade([], 0);
    expect(grade.accuracy).toBe(0);
    expect(grade.completion).toBe(0);
    expect(grade.stars).toBe(0);
    expect(Number.isFinite(grade.rushDragMs)).toBe(true);
    expect(Number.isFinite(grade.timingRmsMs)).toBe(true);
  });

  // TS-U-GRD-012
  it('is deterministic — the same fixture grades identically every run', () => {
    const spec = [...Array(8).fill({ outcome: 'correct', deltaMs: 12 }), { outcome: 'wrong' }, { outcome: 'missed' }];
    const a = computeGrade(results(spec), 10);
    const b = computeGrade(results(spec), 10);
    expect(a).toEqual(b);
  });
});
