// US-3.22 — small status/label pill. Tone follows the screen's role colour
// unless a tone is named; the text always carries the meaning (NFR-008).

import type { ReactNode } from 'react';
import styles from './Pill.module.css';

export function Pill({
  children,
  tone = 'role',
  mono = false,
}: {
  children: ReactNode;
  tone?: 'role' | 'neutral' | 'solid';
  mono?: boolean;
}) {
  return <span className={[styles.pill, styles[tone], mono ? styles.mono : ''].filter(Boolean).join(' ')}>{children}</span>;
}
