import { describe, expect, it } from 'vitest';
import { buildSessionArc } from './arc';
import type { SectionProgress } from '../progression/progression';

function section(id: string, opts: Partial<SectionProgress> = {}): SectionProgress {
  return { sectionId: id, kind: 'quest', bestStars: 0, attempted: false, unlocked: true, ...opts };
}

const fixedRandom = () => 0.5;

describe('buildSessionArc', () => {
  it('wraps quests with a free-play step at each end', () => {
    const arc = buildSessionArc([section('s1'), section('s2')], fixedRandom);
    expect(arc[0]).toEqual({ kind: 'freePlay' });
    expect(arc[arc.length - 1]).toEqual({ kind: 'freePlay' });
  });

  it('excludes locked sections and sections already mastered (2+ stars)', () => {
    const arc = buildSessionArc(
      [section('locked', { unlocked: false }), section('mastered', { bestStars: 2 }), section('open')],
      fixedRandom,
    );
    const questIds = arc.filter((s) => s.kind === 'quest').map((s) => s.sectionId);
    expect(questIds).toEqual(['open']);
  });

  it('caps quest steps at questCount', () => {
    const sections = Array.from({ length: 5 }, (_, i) => section(`s${i}`));
    const arc = buildSessionArc(sections, fixedRandom, 3);
    expect(arc.filter((s) => s.kind === 'quest')).toHaveLength(3);
  });

  it('is deterministic under a fixed random source', () => {
    const sections = Array.from({ length: 5 }, (_, i) => section(`s${i}`));
    const a = buildSessionArc(sections, fixedRandom, 3);
    const b = buildSessionArc(sections, fixedRandom, 3);
    expect(a).toEqual(b);
  });

  it('prefers unattempted sections over attempted-but-under-starred ones', () => {
    const arc = buildSessionArc(
      [section('tried', { attempted: true, bestStars: 1 }), section('fresh')],
      fixedRandom,
      1,
    );
    expect(arc.filter((s) => s.kind === 'quest').map((s) => s.sectionId)).toEqual(['fresh']);
  });
});
