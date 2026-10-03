// US-3.21 — the one look for "still loading" and "that didn't load" moments.
// A picture tile and a calm sentence; the words carry the meaning, the tile
// only decorates (NFR-008). Never phrased as the player's failure (FR-EXP-003).

import type { ReactNode } from 'react';
import styles from './StatusNote.module.css';

export function StatusNote({ tone = 'loading', children }: { tone?: 'loading' | 'problem'; children?: ReactNode }) {
  return (
    <div className={styles.note} role="status">
      <span className={`${styles.tile} ${tone === 'loading' ? styles.pulse : ''}`} aria-hidden="true">
        {tone === 'loading' ? '🎵' : '🧭'}
      </span>
      <span className={styles.text}>{children ?? 'Loading…'}</span>
    </div>
  );
}
