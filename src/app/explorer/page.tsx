// TA-APP-003 `/explorer` — the piece list (US-2.09), routing into
// `/explorer/[arrangementId]`'s quest map. Client component: `ContentBackend`
// is fetch-based (TA-PORT-003), same reasoning as the quest map it links
// into.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../runtime/bootstrap';
import type { ContentIndex } from '../../adapters/ports';
import { PageShell } from '../../ui/shared/PageShell';
import { Card } from '../../ui/shared/Card';

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

  if (!index) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>Pieces</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {index.pieces.map((piece) => (
          <Card key={piece.id}>
            <Link href={`/explorer/${piece.defaultArrangementId}`}>{piece.title}</Link>
          </Card>
        ))}
      </div>
      <p>
        <Link href="/explorer/ninja">Note Ninja</Link>
      </p>
      <p>
        <Link href="/explorer/free-play">Free Play</Link>
      </p>
    </PageShell>
  );
}
