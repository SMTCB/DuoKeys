// TA-APP-003 `/studio` — the adult piece list (US-3.01 slice), modeled on
// `/explorer`'s piece list. Studio practices a whole track, not quests, so
// this links straight into `/studio/play/[arrangementId]` — no quest map.
// US-3.15 adds the "want to learn / learning / learned" repertoire control
// (TA-DAT-007) — an adult-curated list, distinct from progression.
// US-3.21 — pieces drawn as picture-led rows; the status control is a row of
// 44px toggle pills, ticked when on (aria-pressed), so colour is not the only cue.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../runtime/bootstrap';
import type { ContentIndex } from '../../adapters/ports';
import type { LibraryStatus } from '../../core/data/library';
import { useSessionStore } from '../../runtime/stores/sessionStore';
import { useLibraryStore } from '../../runtime/stores/libraryStore';
import { PageShell } from '../../ui/shared/PageShell';
import { StatusNote } from '../../ui/shared/StatusNote';
import { ActionCard } from '../../ui/shared/ActionCard';
import { SyncPanel } from '../../ui/studio/SyncPanel';
import css from '../../ui/shared/ListRow.module.css';

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
    <div className={css.actions} role="group" aria-label="Where this piece is in your repertoire">
      {STATUSES.map((candidate) => (
        <button
          key={candidate}
          type="button"
          className={css.toggle}
          aria-pressed={status === candidate}
          onClick={() =>
            void (status === candidate
              ? clearStatus(profileId, arrangementId)
              : setStatus(profileId, arrangementId, candidate))
          }
        >
          {status === candidate ? '✓ ' : ''}
          {STATUS_LABEL[candidate]}
        </button>
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

  if (!index) return <PageShell><StatusNote /></PageShell>;

  return (
    <PageShell>
      <h1>Studio</h1>
      <ActionCard href="/studio/sight-reading" icon="♫" title="Sight-reading" description="A fresh phrase every time — pick a key, length and tempo." />
      <ActionCard href="/studio/chords" icon="♯" title="Chords & progressions" description="Pick a key, browse its chords and 100+ progressions." />
      <ActionCard href="/studio/library" icon="♩" title="Song library" description="Search 570+ piano pieces and play them as falling notes." />
      <SyncPanel />
      <h2>My pieces</h2>
      <ul className={css.list}>
        {index.pieces.map((piece) => (
          <li key={piece.id} className={css.row}>
            <span className={css.tile} aria-hidden="true">♪</span>
            <div className={css.body}>
              <Link className={css.title} href={`/studio/play/${piece.defaultArrangementId}`}>
                {piece.title}
              </Link>
            </div>
            <LibraryControl profileId={profile.id} arrangementId={piece.defaultArrangementId} />
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
