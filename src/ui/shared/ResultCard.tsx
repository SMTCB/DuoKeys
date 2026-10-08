// US-3.24 / ADR-012 — the card that closes a played piece: a reward surface,
// so it may be bold. A block in the role colour with one big Pop corner, two
// decorative shapes, the stars on a cream badge, a headline, and an optional
// cream footer for the next step. It appears only once the notes have stopped
// (attemptStatus 'complete'), never over the falling notes or the score.
// The stars always carry a text label (NFR-008).

import type { ReactNode } from 'react';
import { PopShape } from './PopShape';
import { RewardBurst } from './RewardBurst';
import styles from './ResultCard.module.css';

export function ResultCard({
  stars,
  title,
  children,
  actions,
  hasBurst = false,
}: {
  stars: number;
  title: string;
  children?: ReactNode;
  /** The next step (a button), set on a cream strip under the colour block. */
  actions?: ReactNode;
  hasBurst?: boolean;
}) {
  return (
    <section className={styles.card} aria-label="Result">
      <div className={styles.block}>
        <PopShape shape="circle" colour="cream" size={72} className={styles.shapeA} />
        <PopShape shape="quarter" colour="tomato" size={56} className={styles.shapeB} />
        <div className={styles.badge}>
          {hasBurst ? <RewardBurst /> : null}
          <span className={styles.stars} role="img" aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'}`}>
            {'⭐'.repeat(stars)}
          </span>
        </div>
        <h2 className={styles.title}>{title}</h2>
        {children ? <div className={styles.body}>{children}</div> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
