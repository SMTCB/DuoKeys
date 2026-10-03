// TA-APP-005 — session arc: a short warm-up, two or three quests, then a
// wind-down (FR-EXP-008). Pure orchestration over an already-computed
// SectionProgress[] — no storage/audio access, no clock (ADR-005).

import type { SectionProgress } from '../progression/progression';

export type ArcStepKind = 'freePlay' | 'quest';

export interface ArcStep {
  kind: ArcStepKind;
  sectionId?: string;
}

/**
 * Picks up to `questCount` unlocked sections worth practicing today —
 * unattempted first, then attempted-but-under-2-stars — and wraps them with
 * a free-play step at each end. `random` only breaks ties when more
 * candidates qualify than `questCount`, keeping the pick deterministic under
 * an injected source (ADR-005).
 */
export function buildSessionArc(
  progress: readonly SectionProgress[],
  random: () => number,
  questCount = 3,
): ArcStep[] {
  const candidates = progress.filter((p) => p.kind === 'quest' && p.unlocked && p.bestStars < 2);
  const unattempted = candidates.filter((p) => !p.attempted);
  const attempted = candidates.filter((p) => p.attempted);
  const ordered = [...shuffle(unattempted, random), ...shuffle(attempted, random)].slice(0, questCount);

  const quests: ArcStep[] = ordered.map((p) => ({ kind: 'quest', sectionId: p.sectionId }));
  return [{ kind: 'freePlay' }, ...quests, { kind: 'freePlay' }];
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
