// TA-APP-003 `/explorer/[arrangementId]` — the quest map (US-2.10), now
// parameterized by arrangement id instead of the one hardcoded piece
// (US-2.09). Client component: reads attempts from IndexedDB via the storage
// port, which has no server-side equivalent (same reasoning as
// `/explorer/play/[id]`, which this page links into with a `?section=`
// param to target a single quest).

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { getAdapters } from '../../../runtime/bootstrap';
import { computeProgression, type SectionProgress } from '../../../core/progression/progression';
import type { Arrangement } from '../../../core/content/types';
import type { Attempt } from '../../../core/data/attempt';
import { PageShell } from '../../../ui/shared/PageShell';
import { Card } from '../../../ui/shared/Card';

export default function ExplorerMapPage() {
  const params = useParams<{ arrangementId: string }>();
  const profile = useSessionStore((s) => s.profile);
  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [progress, setProgress] = useState<SectionProgress[] | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    const adapters = getAdapters();
    adapters.content
      .arrangement(params.arrangementId)
      .then(async (a) => {
        const attempts = await adapters.storage.query<Attempt>('attempts', 'profileId', {
          lower: profile.id,
          upper: profile.id,
        });
        const forThisArrangement = attempts.filter((at) => at.arrangementId === a.id);
        if (!cancelled) {
          setArrangement(a);
          setProgress(computeProgression(a.sections, forThisArrangement));
        }
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [profile.id, params.arrangementId]);

  if (loadError) return <PageShell><p>Could not load this piece: {loadError}</p></PageShell>;
  if (!arrangement || !progress) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>Quest Map</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {progress.map((p) => {
          const section = arrangement.sections.find((s) => s.id === p.sectionId);
          if (!section) return null;
          return (
            <Card key={p.sectionId}>
              {p.unlocked ? (
                <Link href={`/explorer/play/${arrangement.id}?section=${p.sectionId}`}>
                  {section.label}
                  {p.kind === 'reward' ? ' (Reward)' : ''}
                  {p.attempted ? ` ${'⭐'.repeat(p.bestStars)}` : ''}
                </Link>
              ) : (
                <span>🔒 {section.label}</span>
              )}
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
