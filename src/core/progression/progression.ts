// TA-DAT-003 — progression is derived from attempts, never stored as primary
// state (FR-PRO-002: "always recomputable"). This module is pure: the caller
// queries attempts/sections and passes them in, so it stays testable without
// IndexedDB and importable from core/ (ADR-005).
//
// Read-time-only for now — no write-through cache into the `progression`
// IDB store. That store exists (TA-DAT-003) for a future fast-read
// optimization; adding it means keeping a second representation from
// drifting from what this function derives, for no correctness gain at
// today's attempt volumes. Revisit only if map-load latency becomes a
// measured problem, not preemptively.

import type { Attempt } from '../data/attempt';
import type { Section } from '../content/types';
import type { Stars } from '../grade/stars';

export interface SectionProgress {
  sectionId: string;
  kind: Section['kind'];
  bestStars: Stars;
  attempted: boolean;
  unlocked: boolean;
}

function bestForSection(attempts: readonly Attempt[], sectionId: string): { bestStars: Stars; attempted: boolean } {
  const matching = attempts.filter((a) => a.sectionId === sectionId);
  const bestStars = matching.reduce<Stars>((max, a) => (a.grade.stars > max ? a.grade.stars : max), 0);
  return { bestStars, attempted: matching.length > 0 };
}

/** FR-EXP-004 — quest sections unlock in order, one star clears the next; the reward (whole-piece) unlocks once every quest is cleared. */
export function computeProgression(sections: readonly Section[], attempts: readonly Attempt[]): SectionProgress[] {
  const questSections = sections
    .filter((s) => s.kind === 'quest')
    .slice()
    .sort((a, b) => (a.startTick as number) - (b.startTick as number));
  const rewardSection = sections.find((s) => s.kind === 'reward');

  const result: SectionProgress[] = [];
  let previousCleared = true; // the first quest section is always unlocked
  for (const section of questSections) {
    const { bestStars, attempted } = bestForSection(attempts, section.id);
    result.push({ sectionId: section.id, kind: section.kind, bestStars, attempted, unlocked: previousCleared });
    previousCleared = bestStars >= 1;
  }

  if (rewardSection) {
    const { bestStars, attempted } = bestForSection(attempts, rewardSection.id);
    const allQuestsCleared = result.every((r) => r.bestStars >= 1);
    result.push({ sectionId: rewardSection.id, kind: rewardSection.kind, bestStars, attempted, unlocked: allQuestsCleared });
  }

  return result;
}
