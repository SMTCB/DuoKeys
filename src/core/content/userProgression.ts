// FR-STU-015 — a progression the adult typed in. Stored as chord ids on the
// profile's settings record (TA-DAT-003), so it syncs with no table of its own.
// Everything about a chord beyond its id is rebuilt on load.

import type { ChordEntry, ChordIndex, PitchClass, ProgressionEntry } from './chordTypes';
import { chordEntryFromId, chordSymbolOfId, idOfChord, parseProgressionText } from './chordSymbols';
import { NOTE_NAMES } from './chordCatalogue';

export interface UserProgression {
  id: string;
  name: string;
  key: PitchClass;
  mode: 'major' | 'minor';
  chordIds: string[];
  addedAtMs: number;
}

export type MakeUserProgressionResult =
  | { ok: true; progression: UserProgression }
  | { ok: false; error: string };

/** Parses the adult's text into a saveable progression. `id` and `addedAtMs` are injected so this stays pure (ADR-005). */
export function makeUserProgression(input: {
  id: string;
  name: string;
  text: string;
  key: PitchClass;
  mode: 'major' | 'minor';
  addedAtMs: number;
}): MakeUserProgressionResult {
  const { chords, errors } = parseProgressionText(input.text, input.key, input.mode);
  if (errors.length > 0) return { ok: false, error: errors.join('; ') };
  if (chords.length === 0) return { ok: false, error: 'Type at least one chord, like C G Am F' };
  const chordIds = chords.map(idOfChord);
  const name = input.name.trim() || chordIds.map(chordSymbolOfId).join(' ');
  return {
    ok: true,
    progression: { id: input.id, name, key: input.key, mode: input.mode, chordIds, addedAtMs: input.addedAtMs },
  };
}

export function toProgressionEntry(user: UserProgression): ProgressionEntry {
  return {
    id: user.id,
    name: user.name,
    key: user.key,
    mode: user.mode,
    moods: [],
    chordIds: user.chordIds,
    suggestedBpm: 90,
    isUserAdded: true,
  };
}

/** The chord entries a set of user progressions needs. Ids that do not parse are skipped, not fatal. */
export function chordEntriesFor(userProgressions: readonly UserProgression[]): ChordEntry[] {
  const seen = new Set<string>();
  const entries: ChordEntry[] = [];
  for (const p of userProgressions) {
    for (const id of p.chordIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const entry = chordEntryFromId(id);
      if (entry) entries.push(entry);
    }
  }
  return entries;
}

export function keyName(key: PitchClass): string {
  return NOTE_NAMES[key as number] ?? '?';
}

/** Reads the list back off an opaque settings record; anything malformed is ignored. */
export function userProgressionsOf(settings: unknown): UserProgression[] {
  const raw = (settings as { userProgressions?: unknown } | undefined)?.userProgressions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (p): p is UserProgression =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as UserProgression).id === 'string' &&
      Array.isArray((p as UserProgression).chordIds),
  );
}

/** The shipped catalogue with the adult's own progressions (and the chords they need) added; the base is not mutated. */
export function withUserProgressions(base: ChordIndex, userProgressions: readonly UserProgression[]): ChordIndex {
  const known = new Set(base.chords.map((c) => c.id));
  return {
    chords: [...base.chords, ...chordEntriesFor(userProgressions).filter((c) => !known.has(c.id))],
    progressions: [...base.progressions, ...userProgressions.map(toProgressionEntry)],
  };
}
