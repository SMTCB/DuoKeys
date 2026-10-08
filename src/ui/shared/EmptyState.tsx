// US-3.24 / ADR-012 — what a list shows before it has anything in it: a small
// cluster of Pop shapes beside a short, friendly line. A navigation surface,
// so the shapes may mix hues; they are decorative and hidden from assistive
// technology — the words carry the meaning (NFR-008).

import type { ReactNode } from 'react';
import { PopShape } from './PopShape';
import styles from './EmptyState.module.css';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <span className={styles.shapes} aria-hidden="true">
        <PopShape shape="arch" colour="mustard" size={36} />
        <PopShape shape="circle" colour="tomato" size={26} className={styles.small} />
        <PopShape shape="quarter" colour="cornflower" size={30} />
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {children ? <span className={styles.hint}>{children}</span> : null}
      </span>
    </div>
  );
}
