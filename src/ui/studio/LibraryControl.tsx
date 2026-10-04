// TA-DAT-007 — the "want to learn / learning / learned" toggle row, shared by the
// Songs hub for catalogue pieces and the adult's own songs. Keyed by arrangement id,
// so it works for any arrangement (catalogue, library or custom).

'use client';

import { useLibraryStore } from '../../runtime/stores/libraryStore';
import type { LibraryStatus } from '../../core/data/library';
import css from '../shared/ListRow.module.css';

const STATUS_LABEL: Record<LibraryStatus, string> = {
  wantToLearn: 'Want to learn',
  learning: 'Learning',
  learned: 'Learned',
};
const STATUSES: LibraryStatus[] = ['wantToLearn', 'learning', 'learned'];

export function LibraryControl({ profileId, arrangementId }: { profileId: string; arrangementId: string }) {
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
