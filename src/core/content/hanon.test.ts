import { describe, expect, it } from 'vitest';
import { generateHanonArrangement, HANON_PATTERNS } from './hanon';

describe('generateHanonArrangement', () => {
  const pattern = HANON_PATTERNS[0]!;

  it('starts the right hand on the pattern cell at the given octave', () => {
    const arrangement = generateHanonArrangement(pattern, { rightHandOctave: 4 });
    const rh = arrangement.tracks.find((t) => t.id === 'rh')!;
    // Hanon No. 1's cell is C E F G A G F E — the first note is the tonic.
    expect(rh.notes[0]!.pitch).toBe(60); // C4
    expect(rh.notes[1]!.pitch).toBe(64); // E4
  });

  it('plays the left hand the identical shape one octave below by default', () => {
    const arrangement = generateHanonArrangement(pattern);
    const rh = arrangement.tracks.find((t) => t.id === 'rh')!;
    const lh = arrangement.tracks.find((t) => t.id === 'lh')!;
    expect(lh.notes.map((n) => n.pitch)).toEqual(rh.notes.map((n) => (n.pitch as number) - 12));
  });

  it('sequences the cell up one scale degree per measure, then back down', () => {
    const arrangement = generateHanonArrangement(pattern, { ascendDegrees: 1 });
    const rh = arrangement.tracks.find((t) => t.id === 'rh')!;
    // ascendDegrees=1 → measures at degree 0, 1, then back to 0: 3 measures of 8 notes.
    expect(rh.notes).toHaveLength(3 * pattern.cellDegrees.length);
    expect(rh.notes[0]!.pitch).toBe(60); // degree 0: C4
    expect(rh.notes[8]!.pitch).toBe(62); // degree 1: D4 (start of the second measure)
    expect(rh.notes[16]!.pitch).toBe(60); // back down to degree 0
  });

  it('gives every note the pattern’s fixed duration', () => {
    const arrangement = generateHanonArrangement(pattern);
    for (const track of arrangement.tracks) {
      for (const note of track.notes) {
        expect(note.durationTicks).toBe(pattern.noteDurationTicks);
      }
    }
  });

  it('is deterministic — generating twice yields an identical arrangement', () => {
    const a = generateHanonArrangement(pattern);
    const b = generateHanonArrangement(pattern);
    expect(a).toEqual(b);
  });
});

describe('HANON_PATTERNS', () => {
  it('has a unique, non-empty id and cell for every pattern', () => {
    const ids = HANON_PATTERNS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pattern of HANON_PATTERNS) {
      expect(pattern.cellDegrees.length).toBeGreaterThan(0);
      expect(pattern.noteDurationTicks).toBeGreaterThan(0);
    }
  });
});
