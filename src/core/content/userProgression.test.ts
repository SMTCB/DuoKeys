import { describe, expect, it } from 'vitest';
import { asPitchClass } from './chordTypes';
import { chordEntriesFor, makeUserProgression, toProgressionEntry, userProgressionsOf } from './userProgression';

const base = { id: 'u1', name: '', text: 'C G Am F', key: asPitchClass(0), mode: 'major' as const, addedAtMs: 5 };

describe('user progressions', () => {
  it('names an unnamed progression after its chords', () => {
    const result = makeUserProgression(base);
    expect(result).toMatchObject({ ok: true, progression: { name: 'C G Am F', chordIds: ['C-maj', 'G-maj', 'A-min', 'F-maj'] } });
  });

  it('refuses empty and unreadable text with a message', () => {
    expect(makeUserProgression({ ...base, text: '  ' })).toMatchObject({ ok: false });
    expect(makeUserProgression({ ...base, text: 'C Zz' })).toMatchObject({ ok: false, error: expect.stringContaining('Zz') });
  });

  it('produces catalogue entries and dedupes chords', () => {
    const made = makeUserProgression({ ...base, text: 'C C G' });
    if (!made.ok) throw new Error('expected ok');
    expect(chordEntriesFor([made.progression]).map((c) => c.id)).toEqual(['C-maj', 'G-maj']);
    expect(toProgressionEntry(made.progression)).toMatchObject({ isUserAdded: true, id: 'u1' });
  });

  it('ignores a malformed settings record', () => {
    expect(userProgressionsOf(undefined)).toEqual([]);
    expect(userProgressionsOf({ userProgressions: 'nope' })).toEqual([]);
    expect(userProgressionsOf({ userProgressions: [{ id: 'a', chordIds: [] }, 3] })).toHaveLength(1);
  });
});
