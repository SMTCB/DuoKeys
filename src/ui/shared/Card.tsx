// US-3.16 — the generic surface container: quest map, Note Ninja, profile
// picker, Studio piece list.

import type { ReactNode } from 'react';
import styles from './Card.module.css';

export function Card({ children }: { children: ReactNode }) {
  return <section className={styles.card}>{children}</section>;
}
