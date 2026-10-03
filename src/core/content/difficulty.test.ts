import { describe, expect, it } from 'vitest';
import { scoreDifficulty } from './difficulty';
import { asMidiPitch } from '../midi/decode';
import { asTicks } from '../time/types';
import type { ContentNote, Track } from './types';

function note(pitch: number, startTick: number, durationTicks: number, id = `n${startTick}`): ContentNote {
  return {
    id,
    pitch: asMidiPitch(pitch),
    startTick: asTicks(startTick),
    durationTicks: asTicks(durationTicks),
    groupId: id,
    trackId: 'melody',
  };
}

describe('scoreDifficulty', () => {
  it('scores a five-finger C-position melody as low difficulty with a small pitch range', () => {
    const track: Track = {
      id: 'melody',
      role: 'melody',
      hand: 'R',
      notes: [note(64, 0, 480), note(62, 480, 480), note(60, 960, 480), note(67, 1440, 960)],
    };
    const result = scoreDifficulty([track], 'C');
    expect(result.pitchRange).toBe(7); // C4..G4
    expect(result.handPositionChanges).toBe(0);
    expect(result.accidentalDensity).toBe(0);
    expect(result.overall).toBeLessThanOrEqual(2);
  });

  it('flags large interval jumps as hand-position changes', () => {
    const track: Track = {
      id: 'melody',
      role: 'melody',
      hand: 'R',
      notes: [note(60, 0, 480), note(79, 480, 480)], // C4 -> G5, a 19-semitone jump
    };
    const result = scoreDifficulty([track], 'C');
    expect(result.handPositionChanges).toBe(1);
  });

  it('counts out-of-key notes toward accidental density', () => {
    const track: Track = {
      id: 'melody',
      role: 'melody',
      hand: 'R',
      notes: [note(60, 0, 480), note(66, 480, 480), note(62, 960, 480), note(64, 1440, 480)], // F#4 is out of C major
    };
    const result = scoreDifficulty([track], 'C');
    expect(result.accidentalDensity).toBeCloseTo(0.25);
  });

  it('returns overall 1 for an empty arrangement', () => {
    const result = scoreDifficulty([], 'C');
    expect(result.overall).toBe(1);
  });

  it('scores handIndependence as 0 for single-track content', () => {
    const track: Track = { id: 'melody', role: 'melody', hand: 'R', notes: [note(60, 0, 480)] };
    expect(scoreDifficulty([track], 'C').handIndependence).toBe(0);
  });
});
