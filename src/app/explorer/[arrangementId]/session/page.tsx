// TA-APP-005, TA-APP-003 `/explorer/[arrangementId]/session` — US-2.17. A
// short warm-up, 2-3 quests, a wind-down. Sequences the existing quest-map
// practice route and the free-play component rather than inventing a
// parallel practice flow; sessionArcStore just tracks which step is current.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionStore } from '../../../../runtime/stores/sessionStore';
import { useSessionArcStore } from '../../../../runtime/stores/sessionArcStore';
import { getAdapters } from '../../../../runtime/bootstrap';
import { computeProgression, type SectionProgress } from '../../../../core/progression/progression';
import { FreePlay } from '../../../../ui/explorer/FreePlay';
import { PageShell } from '../../../../ui/shared/PageShell';
import { StatusNote } from '../../../../ui/shared/StatusNote';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import type { Arrangement } from '../../../../core/content/types';
import type { Attempt } from '../../../../core/data/attempt';

export default function SessionArcPage() {
  const params = useParams<{ arrangementId: string }>();
  const profile = useSessionStore((s) => s.profile);
  const plan = useSessionArcStore((s) => s.plan);
  const currentIndex = useSessionArcStore((s) => s.currentIndex);
  const active = useSessionArcStore((s) => s.active);
  const startArc = useSessionArcStore((s) => s.startArc);
  const advance = useSessionArcStore((s) => s.advance);

  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
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
        if (cancelled) return;
        setArrangement(a);
        if (!active) {
          const progress: SectionProgress[] = computeProgression(a.sections, forThisArrangement);
          startArc(progress);
        }
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
    // Deliberately excludes `active`/`startArc` — this effect seeds the arc
    // once per page load, not on every store update, so a "Continue your
    // session" navigation back into this route doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, params.arrangementId]);

  if (loadError) return <PageShell><StatusNote tone="problem">Could not load this piece: {loadError}</StatusNote></PageShell>;
  if (!arrangement || !plan) return <PageShell><StatusNote /></PageShell>;

  const step = plan[currentIndex];
  if (!step) return <PageShell><p>Session complete!</p></PageShell>;

  return (
    <PageShell>
      <h1>Session</h1>
      <div
        style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}
        role="img"
        aria-label={`Step ${currentIndex + 1} of ${plan.length}`}
      >
        {plan.map((_, i) => (
          <span
            key={i}
            style={{
              flex: 1,
              height: 10,
              borderRadius: 99,
              background: i <= currentIndex ? 'var(--amber)' : 'var(--amber-tint-2)',
            }}
          />
        ))}
        <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem', marginLeft: '0.4rem' }}>
          {currentIndex + 1}/{plan.length}
        </span>
      </div>

      {step.kind === 'freePlay' && (
        <Card>
          <FreePlay />
          <p>
            <Button accent="amber" onClick={advance}>
              Continue
            </Button>
          </p>
        </Card>
      )}

      {step.kind === 'quest' && step.sectionId && (
        <Card>
          <Link
            href={`/explorer/play/${arrangement.id}?section=${step.sectionId}`}
            style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: '1.1rem' }}
          >
            Start this quest →
          </Link>
        </Card>
      )}
    </PageShell>
  );
}
