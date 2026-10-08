// TA-APP-003 `/explorer/[arrangementId]` — the quest map (US-2.10), now
// parameterized by arrangement id instead of the one hardcoded piece
// (US-2.09). Client component: reads attempts from IndexedDB via the storage
// port, which has no server-side equivalent (same reasoning as
// `/explorer/play/[id]`, which this page links into with a `?section=`
// param to target a single quest).

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { getAdapters } from '../../../runtime/bootstrap';
import { computeProgression, type SectionProgress } from '../../../core/progression/progression';
import type { Arrangement } from '../../../core/content/types';
import type { Attempt } from '../../../core/data/attempt';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { POP_FILL, POP_ON } from '../../../ui/shared/PopShape';
import type { PopColour } from '../../../ui/shared/PopShape';
import { StarRow } from '../../../ui/shared/StarRow';
import styles from './quest.module.css';

// US-3.24 / ADR-012 — the quest map is a navigation surface: each stop's node
// takes the next palette colour, so the path reads as a run of bright beads.
const NODE_COLOURS: readonly PopColour[] = ['tomato', 'mustard', 'cornflower', 'peach'];

// A flat padlock instead of the emoji, for locked stops.
function LockGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="4" y="11" width="16" height="11" rx="3" fill="currentColor" />
    </svg>
  );
}

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

  if (loadError) return <PageShell><StatusNote tone="problem">Could not load this piece: {loadError}</StatusNote></PageShell>;
  if (!arrangement || !progress) return <PageShell><StatusNote /></PageShell>;

  // The first unlocked section with no attempt yet is "where you are".
  const currentId = progress.find((p) => p.unlocked && !p.attempted)?.sectionId;

  return (
    <PageShell tone="bold">
      <h1>Quest Map</h1>
      <ol className={styles.path}>
        {progress.map((p, i) => {
          const section = arrangement.sections.find((s) => s.id === p.sectionId);
          if (!section) return null;
          const isReward = p.kind === 'reward';
          const isCurrent = p.sectionId === currentId;
          const stateClass = !p.unlocked ? styles.locked : isCurrent ? styles.current : p.attempted ? styles.done : styles.open;
          const nodeColour = isReward ? 'ink' : NODE_COLOURS[i % NODE_COLOURS.length] ?? 'mustard';
          // Locked stops stay grey (the stylesheet's dashed look); only open stops take a colour.
          const nodeStyle = !p.unlocked ? undefined : {
            ['--node-bg' as string]: POP_FILL[nodeColour],
            ['--node-on' as string]: isReward ? 'var(--mustard)' : POP_ON[nodeColour],
          } as CSSProperties;
          const body = (
            <>
              <span className={styles.node} aria-hidden="true" style={nodeStyle}>
                {p.unlocked ? (isReward ? '★' : i + 1) : <LockGlyph />}
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{section.label}</span>
                <span className={styles.sub}>
                  {!p.unlocked && 'Locked'}
                  {p.unlocked && isReward && 'Reward'}
                  {p.unlocked && !isReward && isCurrent && 'Start here'}
                  {p.unlocked && !isReward && !isCurrent && p.attempted && 'Play again'}
                </span>
                {p.attempted && (
                  <StarRow stars={p.bestStars} className={styles.stars} />
                )}
              </span>
            </>
          );
          return (
            <li key={p.sectionId} className={`${styles.step} ${stateClass} ${i % 2 ? styles.right : styles.left}`}>
              {p.unlocked ? (
                <Link href={`/explorer/play/${arrangement.id}?section=${p.sectionId}`} className={styles.stop}>
                  {body}
                </Link>
              ) : (
                <div className={styles.stop}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}
