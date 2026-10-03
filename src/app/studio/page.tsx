// TA-APP-003 `/studio` — the adult piece list (US-3.01 slice), modeled on
// `/explorer`'s piece list. Studio practices a whole track, not quests, so
// this links straight into `/studio/play/[arrangementId]` — no quest map.
// US-3.15 adds the "want to learn / learning / learned" repertoire control
// (TA-DAT-007) — an adult-curated list, distinct from progression.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../runtime/bootstrap';
import type { ContentIndex } from '../../adapters/ports';
import type { LibraryStatus } from '../../core/data/library';
import { useSessionStore } from '../../runtime/stores/sessionStore';
import { useLibraryStore } from '../../runtime/stores/libraryStore';
import { PageShell } from '../../ui/shared/PageShell';
import { Card } from '../../ui/shared/Card';
import { Button } from '../../ui/shared/Button';
import { SyncPanel } from '../../ui/studio/SyncPanel';

const STATUS_LABEL: Record<LibraryStatus, string> = {
  wantToLearn: 'Want to learn',
  learning: 'Learning',
  learned: 'Learned',
};
const STATUSES: LibraryStatus[] = ['wantToLearn', 'learning', 'learned'];

function LibraryControl({ profileId, arrangementId }: { profileId: string; arrangementId: string }) {
  const status = useLibraryStore((s) => s.entries.get(arrangementId)?.status);
  const setStatus = useLibraryStore((s) => s.setStatus);
  const clearStatus = useLibraryStore((s) => s.clearStatus);

  return (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      {STATUSES.map((candidate) => (
        <Button
          key={candidate}
          accent="indigo"
          variant={status === candidate ? 'primary' : 'secondary'}
          style={{ padding: '0.35rem 0.8rem', fontSize: '0.85rem' }}
          onClick={() =>
            void (status === candidate
              ? clearStatus(profileId, arrangementId)
              : setStatus(profileId, arrangementId, candidate))
          }
        >
          {STATUS_LABEL[candidate]}
        </Button>
      ))}
    </div>
  );
}

export default function StudioListPage() {
  const [index, setIndex] = useState<ContentIndex | undefined>();
  const profile = useSessionStore((s) => s.profile);
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);

  useEffect(() => {
    let cancelled = false;
    getAdapters().content.index().then((i) => {
      if (!cancelled) setIndex(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadLibrary(profile.id);
  }, [profile.id, loadLibrary]);

  if (!index) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>Studio</h1>
      <SyncPanel />
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <strong>Sight-Reading</strong>
            <p style={{ margin: '0.25rem 0 0' }}>A fresh phrase every time — pick a key, length and tempo.</p>
          </div>
          <Link href="/studio/sight-reading">
            <Button accent="indigo">Generate a phrase</Button>
          </Link>
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {index.pieces.map((piece) => (
          <Card key={piece.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <Link href={`/studio/play/${piece.defaultArrangementId}`}>{piece.title}</Link>
              <LibraryControl profileId={profile.id} arrangementId={piece.defaultArrangementId} />
            </div>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
