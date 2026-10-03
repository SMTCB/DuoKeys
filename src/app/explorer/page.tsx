// TA-APP-003 `/explorer` — the piece list (US-2.09), routing into
// `/explorer/[arrangementId]`'s quest map. Client component: `ContentBackend`
// is fetch-based (TA-PORT-003), same reasoning as the quest map it links
// into.

'use client';

import { useEffect, useState } from 'react';
import { getAdapters } from '../../runtime/bootstrap';
import type { ContentIndex } from '../../adapters/ports';
import { PageShell } from '../../ui/shared/PageShell';
import { StatusNote } from '../../ui/shared/StatusNote';
import { ActionCard } from '../../ui/shared/ActionCard';

export default function ExplorerListPage() {
  const [index, setIndex] = useState<ContentIndex | undefined>();

  useEffect(() => {
    let cancelled = false;
    getAdapters().content.index().then((i) => {
      if (!cancelled) setIndex(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!index) return <PageShell><StatusNote /></PageShell>;

  return (
    <PageShell>
      <h1>What shall we play?</h1>
      <ActionCard href="/explorer/ninja" icon="♪" title="Note Ninja" description="Find the note, as fast as you can." />
      <ActionCard href="/explorer/free-play" icon="✦" title="Free Play" description="Press any key and make some music." />
      <h2>Pieces</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {index.pieces.map((piece, i) => (
          <ActionCard
            key={piece.id}
            href={`/explorer/${piece.defaultArrangementId}`}
            icon={i + 1}
            title={piece.title}
          />
        ))}
      </div>
    </PageShell>
  );
}
