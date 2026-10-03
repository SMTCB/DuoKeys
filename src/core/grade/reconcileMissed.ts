// TA-MAT-003 — session-layer reconciliation of unplayed expected notes.
//
// Matcher.consume() returns exactly one result per call, so a matcher has no
// way to proactively report a note that is simply never played. Instead, any
// expected note left unresolved once an attempt ends is `missed` by
// elimination. WaitMatcher never leaves gaps (no failure path — FR-EXP-003),
// so this is a no-op for wait-mode attempts; it only ever adds entries for
// TimedMatcher attempts.

import type { ExpectedNote } from '../match/types';
import type { NoteResult } from './grade';

export function reconcileMissed(allExpected: readonly ExpectedNote[], perNote: readonly NoteResult[]): NoteResult[] {
  const resolvedIds = new Set(
    perNote.filter((n) => n.outcome === 'correct' || n.outcome === 'wrong').map((n) => n.expectedId),
  );
  const missed: NoteResult[] = allExpected
    .filter((e) => !resolvedIds.has(e.id))
    .map((e) => ({ expectedId: e.id, pitch: e.pitch, outcome: 'missed' as const }));
  return [...perNote, ...missed];
}
