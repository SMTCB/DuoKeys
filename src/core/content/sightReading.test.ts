import { describe, expect, it } from 'vitest';
import { generateSightReadingArrangement } from './sightReading';
import { PPQ } from '../time/types';
import { DIATONIC_PITCH_CLASSES } from './difficulty';

const fixedRandom = () => 0.5;

function cyclingRandom(seq: number[]): () => number {
  let i = 0;
  return () => seq[i++ % seq.length]!;
}

describe('generateSightReadingArrangement', () => {
  it('fills exactly `bars` of `beatsPerBar`/4 time', () => {
    const arrangement = generateSightReadingArrangement(fixedRandom, { bars: 4, beatsPerBar: 3 });
    const melody = arrangement.tracks.find((t) => t.id === 'melody')!;
    const last = melody.notes[melody.notes.length - 1]!;
    const totalTicks = (last.startTick as number) + (last.durationTicks as number);
    expect(totalTicks).toBe(4 * 3 * PPQ);
  });

  it('every note falls within the requested pitch range and stays diatonic', () => {
    const random = cyclingRandom([0.05, 0.3, 0.6, 0.95, 0.15, 0.75, 0.42, 0.88]);
    const arrangement = generateSightReadingArrangement(random, {
      keySig: 'C',
      rangeLowMidi: 60,
      rangeHighMidi: 72,
    });
    const scale = DIATONIC_PITCH_CLASSES.C!;
    for (const note of arrangement.tracks[0]!.notes) {
      const pitch = note.pitch as number;
      expect(pitch).toBeGreaterThanOrEqual(60);
      expect(pitch).toBeLessThanOrEqual(72);
      expect(scale).toContain(((pitch % 12) + 12) % 12);
    }
  });

  it('draws every note duration from the rhythmic vocabulary supplied', () => {
    const random = cyclingRandom([0.1, 0.4, 0.7, 0.2, 0.9]);
    const vocabulary = [PPQ, PPQ / 2, PPQ / 4];
    const arrangement = generateSightReadingArrangement(random, { rhythmicVocabularyTicks: vocabulary });
    for (const note of arrangement.tracks[0]!.notes) {
      expect(vocabulary).toContain(note.durationTicks as number);
    }
  });

  it('is deterministic — the same random source and options grade identically', () => {
    const random = () => {
      randomCallCount++;
      return (randomCallCount % 7) / 7;
    };
    let randomCallCount = 0;
    const a = generateSightReadingArrangement(random, { id: 'fixture' });
    randomCallCount = 0;
    const b = generateSightReadingArrangement(random, { id: 'fixture' });
    expect(a).toEqual(b);
  });

  it('produces a different phrase for a different random source', () => {
    const a = generateSightReadingArrangement(cyclingRandom([0.1, 0.2, 0.3]), { id: 'fixture' });
    const b = generateSightReadingArrangement(cyclingRandom([0.9, 0.8, 0.7]), { id: 'fixture' });
    const pitchesA = a.tracks[0]!.notes.map((n) => n.pitch);
    const pitchesB = b.tracks[0]!.notes.map((n) => n.pitch);
    expect(pitchesA).not.toEqual(pitchesB);
  });

  it('respects a different key signature', () => {
    const arrangement = generateSightReadingArrangement(fixedRandom, { keySig: 'F', rangeLowMidi: 53, rangeHighMidi: 65 });
    const scale = DIATONIC_PITCH_CLASSES.F!;
    for (const note of arrangement.tracks[0]!.notes) {
      const pitch = note.pitch as number;
      expect(scale).toContain(((pitch % 12) + 12) % 12);
    }
  });

  it('reuses the standard content pipeline — difficulty analysis and sections are populated', () => {
    const arrangement = generateSightReadingArrangement(fixedRandom);
    expect(arrangement.analysis.overall).toBeGreaterThanOrEqual(1);
    expect(arrangement.sections.length).toBeGreaterThan(0);
  });
});
