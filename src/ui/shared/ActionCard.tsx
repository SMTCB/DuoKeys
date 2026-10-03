// US-3.21 — a whole-card link with a role-coloured picture tile, used for the
// destinations on the Explorer and Studio homes. The picture and the title
// both say what it is, so colour is never the only cue (NFR-008).

import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './ActionCard.module.css';

export function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <Link href={href} className={styles.card}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}
