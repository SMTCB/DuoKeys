// TA-SYN-007 — local record <-> Supabase row mapping round-trips.

import { describe, expect, it } from 'vitest';
import { deleteFilter, fromRow, toRow } from './mapping';
import { asMidiPitch } from '../../core/midi/decode';
import { asMillis } from '../../core/time/types';
import type { Profile } from '../../core/profile/types';
import type { LibraryEntry } from '../../core/data/library';
import type { Attempt } from '../../core/data/attempt';

const profile: Profile = {
  id: 'p1',
  displayName: 'Mia',
  role: 'explorer',
  keyboardRange: { low: asMidiPitch(21), high: asMidiPitch(108) },
  latencyOffsetMs: 12.5,
  toleranceScale: 1.6,
  avatar: 'piano',
};

describe('sync row mapping', () => {
  it('round-trips a profile, with and without a midi input', () => {
    expect(fromRow('profiles', toRow('profiles', profile, 1000))).toEqual(profile);
    const withInput = { ...profile, midiInputId: 'usb-1' };
    expect(fromRow('profiles', toRow('profiles', withInput, 1000))).toEqual(withInput);
  });

  it('stamps a profile row with the write time, since profiles carry no updatedAt', () => {
    expect(toRow('profiles', profile, 4242).updated_at_ms).toBe(4242);
  });

  it('round-trips a library entry', () => {
    const entry: LibraryEntry = {
      profileId: 'p1',
      arrangementId: 'mary-d1',
      status: 'learning',
      addedAtMs: asMillis(1),
      updatedAtMs: asMillis(2),
    };
    expect(fromRow('library', toRow('library', entry, 99))).toEqual(entry);
  });

  it('round-trips settings as an opaque data blob keyed by profile', () => {
    const settings = { profileId: 'p1', updatedAtMs: 7, theme: 'dark', volume: 0.5 };
    const row = toRow('settings', settings, 99);
    expect(row).toEqual({ profile_id: 'p1', data: { theme: 'dark', volume: 0.5 }, updated_at_ms: 7 });
    expect(fromRow('settings', row)).toEqual(settings);
  });

  it('round-trips an attempt, keeping its embedded grade and events', () => {
    const attempt = {
      id: 'a1',
      profileId: 'p1',
      arrangementId: 'mary-d1',
      sectionId: 's1',
      startedAt: '2026-10-03T12:00:00.000Z',
      durationMs: 4200,
      mode: 'wait',
      tempoScale: 1,
      grade: { stars: 2, perNote: [] },
      events: [],
      appVersion: '0.1.0',
    } as unknown as Attempt;
    expect(fromRow('attempts', toRow('attempts', attempt, 1))).toEqual(attempt);
  });

  it('splits a library key into the columns a server delete needs', () => {
    expect(deleteFilter('library', 'p1+mary-d1')).toEqual({ profile_id: 'p1', arrangement_id: 'mary-d1' });
  });
});
