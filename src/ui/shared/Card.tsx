// US-3.16 — the generic surface container: quest map, Note Ninja, profile
// picker, Studio piece list.

import type { ReactNode } from 'react';
import styles from './Card.module.css';

/** `tint` washes the card in one of the tile colours, so a panel that opens from a tile reads as that tile's. */
export function Card({ children, tint }: { children: ReactNode; tint?: 'mustard' | 'peach' | 'cornflower' }) {
  const className = tint === undefined ? styles.card : `${styles.card} ${styles.tinted} ${styles[tint]}`;
  return <section className={className}>{children}</section>;
}
