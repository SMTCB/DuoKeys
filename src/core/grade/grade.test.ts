import { describe, expect, it } from 'vitest';
import { computeGrade, describeArticulation, describeRushDrag, type Grade, type NoteResult } from './grade';
import { asMidiPitch } from '../midi/decode';

function results(spec: { outcome: NoteResult['outcome']; deltaMs?: number; onsetMs?: number }[]): NoteResult[] {
  return spec.map((s, i) => {
    const base: NoteResult = { pitch: asMidiPitch(60 + i), outcome: s.outcome };
    return {
      ...base,
      ...(s.deltaMs === undefined ? {} : { deltaMs: s.deltaMs }),
      ...(s.onsetMs === undefined ? {} : { onsetMs: s.onsetMs }),
    };
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

  // TS-U-GRD-015
  it('Explorer floor applies even when the attempt is not fully completed', () => {
    const spec = [...Array(2).fill({ outcome: 'correct' }), ...Array(2).fill({ outcome: 'missed' })];
    const grade = computeGrade(results(spec), 10, { explorerFloor: true });
    expect(grade.completion).toBeCloseTo(0.4);
    expect(grade.stars).toBeGreaterThanOrEqual(1);
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

  // TS-U-GRD-008
  it('perfectly even intervals grade evennessCv at 0', () => {
    const spec = Array.from({ length: 5 }, (_, i) => ({ outcome: 'correct' as const, onsetMs: i * 200 }));
    const grade = computeGrade(results(spec), 5);
    expect(grade.evennessCv).toBeCloseTo(0);
  });

  // TS-U-GRD-009
  it('lumpy intervals grade evennessCv above 0.20', () => {
    const onsets = [0, 200, 210, 600, 620, 1400];
    const spec = onsets.map((onsetMs) => ({ outcome: 'correct' as const, onsetMs }));
    const grade = computeGrade(results(spec), onsets.length);
    expect(grade.evennessCv).toBeGreaterThan(0.2);
  });

  it('leaves evennessCv absent with fewer than three onsets', () => {
    const spec = [
      { outcome: 'correct' as const, onsetMs: 0 },
      { outcome: 'correct' as const, onsetMs: 200 },
    ];
    const grade = computeGrade(results(spec), 2);
    expect(grade.evennessCv).toBeUndefined();
  });

  // TS-U-GRD-012
  it('is deterministic — the same fixture grades identically every run', () => {
    const spec = [...Array(8).fill({ outcome: 'correct', deltaMs: 12 }), { outcome: 'wrong' }, { outcome: 'missed' }];
    const a = computeGrade(results(spec), 10);
    const b = computeGrade(results(spec), 10);
    expect(a).toEqual(b);
  });
});

describe('describeRushDrag', () => {
  // TS-U-GRD-018
  it('phrases a negative offset as ahead of the beat', () => {
    expect(describeRushDrag(-40)).toBe('40 ms ahead of the beat');
  });

  // TS-U-GRD-018
  it('phrases a positive offset as behind the beat', () => {
    expect(describeRushDrag(40)).toBe('40 ms behind the beat');
  });

  // TS-U-GRD-018
  it('phrases zero as right on the beat', () => {
    expect(describeRushDrag(0)).toBe('right on the beat');
  });

  // TS-U-GRD-019
  it('rounds fractional milliseconds', () => {
    expect(describeRushDrag(-39.6)).toBe('40 ms ahead of the beat');
  });
});

describe('describeArticulation', () => {
  function grade(articulations: NoteResult['articulation'][]): Grade {
    const perNote = articulations.map((articulation, i) => {
      const base: NoteResult = { pitch: asMidiPitch(60 + i), outcome: 'correct' };
      return articulation === undefined ? base : { ...base, articulation };
    });
    return computeGrade(perNote, perNote.length);
  }

  // TS-U-GRD-020
  it('reports nothing when no note was classified', () => {
    expect(describeArticulation(grade([undefined, undefined]))).toBeUndefined();
  });

  // TS-U-GRD-020
  it('reports a clean match when every classified note was even', () => {
    expect(describeArticulation(grade(['even', 'even']))).toBe('Your note lengths matched what was written.');
  });

  // TS-U-GRD-021
  it('leads with the short count when short notes outnumber long ones', () => {
    expect(describeArticulation(grade(['short', 'short', 'long', 'even']))).toBe(
      '2 notes cut short — try holding a little longer.',
    );
  });

  // TS-U-GRD-021
  it('leads with the long count when long notes outnumber short ones', () => {
    expect(describeArticulation(grade(['long', 'long', 'short', 'even']))).toBe(
      '2 notes held too long — try releasing a little sooner.',
    );
  });

  // TS-U-GRD-021
  it('uses singular phrasing for a single note', () => {
    expect(describeArticulation(grade(['short']))).toBe('1 note cut short — try holding a little longer.');
  });
});
