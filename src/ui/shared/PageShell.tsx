// US-3.16 — replaces the bare <main> every route used to render directly.
// US-3.21 — brings the Design Reference identity to every route in one place:
// the logo lockup in a top bar, and the role colour (amber = Explorer,
// indigo = Studio, coral = shared) taken from the route and exposed to
// children as --role / --role-deep / --role-tint.

'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import styles from './PageShell.module.css';

type Role = 'explorer' | 'studio' | 'shared';

const ROLE_LABEL: Record<Role, string | undefined> = {
  explorer: 'Explorer',
  studio: 'Studio',
  shared: undefined,
};

const ROLE_VARS: Record<Role, CSSProperties> = {
  explorer: {
    ['--role' as string]: 'var(--amber)',
    ['--role-deep' as string]: 'var(--amber-deep)',
    ['--role-tint' as string]: 'var(--amber-tint)',
  },
  studio: {
    ['--role' as string]: 'var(--indigo)',
    ['--role-deep' as string]: 'var(--indigo-deep)',
    ['--role-tint' as string]: 'var(--indigo-tint)',
  },
  shared: {
    ['--role' as string]: 'var(--coral)',
    ['--role-deep' as string]: 'var(--coral-deep)',
    ['--role-tint' as string]: 'var(--coral-tint)',
  },
};

function roleOfPath(pathname: string | null): Role {
  if (pathname?.startsWith('/explorer')) return 'explorer';
  if (pathname?.startsWith('/studio')) return 'studio';
  return 'shared';
}

export function PageShell({ children }: { children: ReactNode }) {
  const role = roleOfPath(usePathname());
  const roleLabel = ROLE_LABEL[role];
  return (
    <main className={styles.shell} style={ROLE_VARS[role]}>
      <div className={styles.inner}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label="DuoKeys — choose who is playing">
            <Logo size={34} />
          </Link>
          {roleLabel ? (
            <Link href={`/${role}`} className={styles.rolePill}>
              {roleLabel}
            </Link>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
