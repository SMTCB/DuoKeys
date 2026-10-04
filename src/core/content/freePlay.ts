// FR-STU-018 — "play something for me": pick an easy, good-sounding progression and a
// rhythm for the adult who just wants to sit down and play without choosing. Pure;
// randomness is injected (ADR-005), so the same draw gives the same suggestion.

import type { PitchClass, ProgressionEntry } from './chordTypes';
import { chordFromId } from './chordSymbols';
import { CHORD_STYLES, styleFilePath, type ChordStyleId } from './styledProgression';

export interface FreePlaySuggestion {
  progression: ProgressionEntry;
  style: ChordStyleId | 'block';
  /** how the chords read on a chart, e.g. "C G Am F" is built by the caller from chordIds */
  distinctChordCount: number;
}

/** Plain major and minor triads and sevenths: the chords a relaxed player can reach without thinking. */
const EASY_QUALITIES = new Set(['maj', 'min', 'dom7', 'maj7', 'min7', 'sus2', 'sus4']);
const MAX_EASY_DISTINCT_CHORDS = 4;

export function isEasyProgression(p: ProgressionEntry): boolean {
  const distinct = new Set(p.chordIds);
  if (distinct.size > MAX_EASY_DISTINCT_CHORDS) return false;
  return [...distinct].every((id) => {
    const c = chordFromId(id);
    return c !== undefined && EASY_QUALITIES.has(c.quality);
  });
}

/** Every mood the catalogue's easy progressions carry, most common first. */
export function easyMoods(progressions: readonly ProgressionEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const p of progressions.filter(isEasyProgression)) {
    for (const m of p.moods) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([m]) => m);
}

function pick<T>(items: readonly T[], random: () => number): T | undefined {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))];
}

/**
 * One suggestion. `mood` narrows the pool when any easy progression has it; otherwise
 * the whole easy pool is used, so the button never comes back empty-handed.
 * `avoidId` keeps "another one" from repeating the last pick when there is a choice.
 */
export function pickFreePlay(
  progressions: readonly ProgressionEntry[],
  options: { mood?: string; avoidId?: string; key?: PitchClass },
  random: () => number,
): FreePlaySuggestion | undefined {
  const easy = progressions.filter(isEasyProgression).filter((p) => options.key === undefined || p.key === options.key);
  const moody = options.mood ? easy.filter((p) => p.moods.includes(options.mood!)) : easy;
  let pool = moody.length > 0 ? moody : easy;
  if (options.avoidId !== undefined && pool.length > 1) pool = pool.filter((p) => p.id !== options.avoidId);
  const progression = pick(pool, random);
  if (!progression) return undefined;
  const styles = CHORD_STYLES.filter((s) => styleFilePath(s.id, progression) !== undefined);
  const chosen = pick(styles, random);
  return {
    progression,
    style: chosen ? chosen.id : 'block',
    distinctChordCount: new Set(progression.chordIds).size,
  };
}

/**
 * The same progression (same degrees, so the same mood) in another key, or undefined when the
 * catalogue has none, as it does for a progression the adult typed in.
 */
export function sameProgressionInKey(
  progressions: readonly ProgressionEntry[],
  progression: ProgressionEntry,
  key: PitchClass,
): ProgressionEntry | undefined {
  if (progression.isUserAdded) return undefined;
  const isRepeat = progression.id.endsWith('~2');
  return progressions.find(
    (p) =>
      !p.isUserAdded &&
      p.key === key &&
      p.name === progression.name &&
      p.mode === progression.mode &&
      p.id.endsWith('~2') === isRepeat,
  );
}
