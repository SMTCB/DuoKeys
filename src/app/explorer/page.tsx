// TA-APP-003 `/explorer` — the quest map (US-2.10). Client component: reads
// attempts from IndexedDB via the storage port, which has no server-side
// equivalent (same reasoning as `/explorer/play/[id]`, which this page links
// into with a `?section=` param to target a single quest).

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSessionStore } from '../../runtime/stores/sessionStore';
import { MARY_HAD_A_LITTLE_LAMB } from '../../adapters/content/maryHadALittleLamb';
import { computeProgression, type SectionProgress } from '../../core/progression/progression';
import type { Arrangement } from '../../core/content/types';
import type { Attempt } from '../../core/data/attempt';

export default function ExplorerMapPage() {
  const adapters = useSessionStore((s) => s.adapters);
  const profile = useSessionStore((s) => s.profile);
  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [progress, setProgress] = useState<SectionProgress[] | undefined>();

  useEffect(() => {
    let cancelled = false;
    adapters.content.arrangement(MARY_HAD_A_LITTLE_LAMB.id).then(async (a) => {
      const attempts = await adapters.storage.query<Attempt>('attempts', 'profileId', {
        lower: profile.id,
        upper: profile.id,
      });
      const forThisArrangement = attempts.filter((at) => at.arrangementId === a.id);
      if (!cancelled) {
        setArrangement(a);
        setProgress(computeProgression(a.sections, forThisArrangement));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [adapters, profile.id]);

  if (!arrangement || !progress) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>Quest Map</h1>
      <ul>
        {progress.map((p) => {
          const section = arrangement.sections.find((s) => s.id === p.sectionId);
          if (!section) return null;
          return (
            <li key={p.sectionId}>
              {p.unlocked ? (
                <Link href={`/explorer/play/${arrangement.id}?section=${p.sectionId}`}>
                  {section.label}
                  {p.kind === 'reward' ? ' (Reward)' : ''}
                  {p.attempted ? ` ${'⭐'.repeat(p.bestStars)}` : ''}
                </Link>
              ) : (
                <span>🔒 {section.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
