// US-3.16 — replaces the bare <main> every route used to render directly.

import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.shell}>
      <div className={styles.inner}>{children}</div>
    </main>
  );
}
