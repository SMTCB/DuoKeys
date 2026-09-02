import { describe, expect, it } from 'vitest';
import { notesInSection } from './sectionNotes';
import { asTicks } from '../time/types';
import { asMidiPitch } from '../midi/decode';
import type { ContentNote, Section } from './types';

const section: Section = {
  id: 'bars-1-2',
  label: 'Bars 1–2',
  startTick: asTicks(0),
  endTick: asTicks(3840),
  barRange: [1, 2],
  kind: 'quest',
};

function note(startTick: number): ContentNote {
  return {
    id: `n-${startTick}`,
    pitch: asMidiPitch(60),
    startTick: asTicks(startTick),
    durationTicks: asTicks(480),
    groupId: `n-${startTick}`,
    trackId: 'melody',
  };
}

describe('notesInSection (TS-U-CNT-016)', () => {
  it('includes a note exactly at startTick', () => {
    expect(notesInSection([note(0)], section)).toHaveLength(1);
  });

  it('excludes a note exactly at endTick (half-open range)', () => {
    expect(notesInSection([note(3840)], section)).toHaveLength(0);
  });

  it('includes a note strictly between startTick and endTick', () => {
    expect(notesInSection([note(1920)], section)).toHaveLength(1);
  });

  it('excludes a note before startTick', () => {
    expect(notesInSection([note(-480)], section)).toHaveLength(0);
  });

  it('returns an empty array for an empty note list', () => {
    expect(notesInSection([], section)).toEqual([]);
  });
});
