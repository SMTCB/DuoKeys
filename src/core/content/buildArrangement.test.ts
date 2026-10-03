import { describe, expect, it } from 'vitest';
import { buildArrangementFromSource, type SourceInput } from './buildArrangement';
import marySource from '../../../content/sources/mary-had-a-little-lamb.json';

describe('buildArrangementFromSource', () => {
  it('normalises a two-note track to absolute ticks with grouping', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      tracks: [
        {
          id: 'melody',
          role: 'melody',
          hand: 'R',
          notes: [
            { pitch: 'C4', durationTicks: 1920 },
            { pitch: 'D4', durationTicks: 1920 },
          ],
        },
      ],
    };
    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.tracks[0]!.notes).toEqual([
      { id: 'n1', pitch: 60, startTick: 0, durationTicks: 1920, groupId: 'g0', trackId: 'melody' },
      { id: 'n2', pitch: 62, startTick: 1920, durationTicks: 1920, groupId: 'g1', trackId: 'melody' },
    ]);
  });

  it('advances the cursor past a rest without emitting a note', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      barsPerQuest: 1,
      tracks: [
        {
          id: 'melody',
          role: 'melody',
          notes: [
            { pitch: 'C4', durationTicks: 480 },
            { durationTicks: 480, rest: true },
            { pitch: 'D4', durationTicks: 960 },
          ],
        },
      ],
    };
    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.tracks[0]!.notes).toEqual([
      { id: 'n1', pitch: 60, startTick: 0, durationTicks: 480, groupId: 'g0', trackId: 'melody' },
      { id: 'n3', pitch: 62, startTick: 960, durationTicks: 960, groupId: 'g1', trackId: 'melody' },
    ]);
  });

  it('gives a chord note the same start tick as its base note and does not double-advance the cursor', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      barsPerQuest: 1,
      tracks: [
        {
          id: 'lh',
          role: 'lh',
          hand: 'L',
          notes: [
            { pitch: 'C3', durationTicks: 960 },
            { pitch: 'G3', durationTicks: 480, chord: true },
            { pitch: 'E3', durationTicks: 960 },
          ],
        },
      ],
    };
    const arrangement = buildArrangementFromSource(source);
    const notes = arrangement.tracks[0]!.notes;
    expect(notes[0]).toMatchObject({ pitch: 48, startTick: 0, durationTicks: 960 });
    expect(notes[1]).toMatchObject({ pitch: 55, startTick: 0, durationTicks: 480 });
    expect(notes[0]!.groupId).toBe(notes[1]!.groupId);
    expect(notes[2]).toMatchObject({ pitch: 52, startTick: 960, durationTicks: 960 });
  });

  it('throws when a non-rest note has no pitch', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      tracks: [{ id: 'melody', role: 'melody', notes: [{ durationTicks: 480 }] }],
    };
    expect(() => buildArrangementFromSource(source)).toThrow(/no pitch and is not a rest/);
  });

  it('converts chordMarkers to absolute ticks when present (FR-STU-013)', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      barsPerQuest: 1,
      tracks: [{ id: 'melody', role: 'melody', notes: [{ pitch: 'C4', durationTicks: 1920 }] }],
      chordMarkers: [
        { atTick: 0, symbol: 'C' },
        { atTick: 960, symbol: 'G' },
      ],
    };
    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.chordMarkers).toEqual([
      { atTick: 0, symbol: 'C' },
      { atTick: 960, symbol: 'G' },
    ]);
  });

  it('omits chordMarkers entirely when the source has none', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      barsPerQuest: 1,
      tracks: [{ id: 'melody', role: 'melody', notes: [{ pitch: 'C4', durationTicks: 1920 }] }],
    };
    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.chordMarkers).toBeUndefined();
    expect('chordMarkers' in arrangement).toBe(false);
  });

  it('derives the arrangement id from pieceId and computed difficulty', () => {
    const source: SourceInput = {
      id: 'test-piece',
      title: 'Test Piece',
      tempoBpm: 100,
      timeSig: [4, 4],
      keySig: 'C',
      tracks: [{ id: 'melody', role: 'melody', notes: [{ pitch: 'C4', durationTicks: 3840 }] }],
    };
    const arrangement = buildArrangementFromSource(source);
    expect(arrangement.id).toBe(`test-piece-d${arrangement.difficulty}`);
    expect(arrangement.pieceId).toBe('test-piece');
  });

  // Golden test — TS-U-CNT-017. Asserts the ingested Mary Had a Little Lamb
  // output preserves the invariants the old hand-authored arrangement had
  // before the content pipeline replaced it.
  describe('mary-had-a-little-lamb.json, ingested', () => {
    const TOTAL_TICKS = 8 * 4 * 480; // 8 bars of 4/4 at PPQ 480

    const arrangement = buildArrangementFromSource(marySource as unknown as SourceInput);

    it('spans exactly 8 bars', () => {
      const melody = arrangement.tracks[0]!;
      const last = melody.notes[melody.notes.length - 1]!;
      expect((last.startTick as number) + (last.durationTicks as number)).toBe(TOTAL_TICKS);
    });

    it('is monophonic — every note gets its own groupId', () => {
      const melody = arrangement.tracks[0]!;
      const groupIds = melody.notes.map((n) => n.groupId);
      expect(new Set(groupIds).size).toBe(melody.notes.length);
    });

    it('resolves its licence', () => {
      expect(arrangement.pieceId).toBe('mary-had-a-little-lamb');
    });

    it('segments into 4 contiguous 2-bar quest sections plus one whole-piece reward', () => {
      const quests = arrangement.sections.filter((s) => s.kind === 'quest');
      const rewards = arrangement.sections.filter((s) => s.kind === 'reward');
      expect(quests).toHaveLength(4);
      expect(rewards).toHaveLength(1);

      let expectedStart = 0;
      for (const quest of quests) {
        expect(quest.startTick).toBe(expectedStart);
        expectedStart = quest.endTick as number;
      }
      expect(expectedStart).toBe(TOTAL_TICKS);

      expect(rewards[0]!.startTick).toBe(0);
      expect(rewards[0]!.endTick).toBe(TOTAL_TICKS);
    });

    it('lands at difficulty 1', () => {
      expect(arrangement.difficulty).toBe(1);
    });
  });
});
