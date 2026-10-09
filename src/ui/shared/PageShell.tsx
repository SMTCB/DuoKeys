// US-3.16 — replaces the bare <main> every route used to render directly.
// US-3.21 — brings the Design Reference identity to every route in one place:
// the logo lockup in a top bar, and the role colour (amber = Explorer,
// indigo = Studio, coral = shared) taken from the route and exposed to
// children as --role / --role-deep / --role-tint.
// US-3.23 / ADR-012 — the Pop restyle: role families now take the Pop palette
// (mustard / cornflower / tomato), and a page picks a bold or calm tone.

'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { useT } from '../i18n/useT';
import styles from './PageShell.module.css';

type Role = 'explorer' | 'studio' | 'shared';

const ROLE_LABEL: Record<Role, string | undefined> = {
  explorer: 'Explorer',
  studio: 'Studio',
  shared: undefined,
};

// --play-* are the only colours a practice surface (falling notes, score,
// keybed) may read: one note hue per role, strong enough on the cream surface
// (>= 3:1), plus ink. ADR-012 keeps those surfaces calm.
const ROLE_VARS: Record<Role, CSSProperties> = {
  explorer: {
    ['--role' as string]: 'var(--amber)',
    ['--role-deep' as string]: 'var(--amber-deep)',
    ['--role-tint' as string]: 'var(--amber-tint)',
    ['--on-role' as string]: 'var(--on-amber)',
    ['--play-note' as string]: '#d9661f',
    ['--play-note-deep' as string]: 'var(--amber-deep)',
  },
  studio: {
    ['--role' as string]: 'var(--indigo)',
    ['--role-deep' as string]: 'var(--indigo-deep)',
    ['--role-tint' as string]: 'var(--indigo-tint)',
    ['--on-role' as string]: 'var(--on-indigo)',
    ['--play-note' as string]: 'var(--cornflower)',
    ['--play-note-deep' as string]: 'var(--cornflower-deep)',
  },
  shared: {
    ['--role' as string]: 'var(--coral)',
    ['--role-deep' as string]: 'var(--coral-deep)',
    ['--role-tint' as string]: 'var(--coral-tint)',
    ['--on-role' as string]: 'var(--on-coral)',
    ['--play-note' as string]: 'var(--tomato)',
    ['--play-note-deep' as string]: 'var(--tomato-deep)',
  },
};

function roleOfPath(pathname: string | null): Role {
  if (pathname?.startsWith('/explorer')) return 'explorer';
  if (pathname?.startsWith('/studio')) return 'studio';
  return 'shared';
}

/**
 * `tone="bold"` is for navigation homes only (the family screen, the Explorer
 * and Studio homes): the Studio home sits on a cornflower ground and the page
 * may use colour-block tiles. Everything else, and every practice screen, is
 * `calm` (the default): a cream ground, a thin role stripe, and nothing
 * decorative near the notes (ADR-012).
 *
 * `back` draws a "← where you came from" pill under the top bar, so every screen
 * below a home has one way up that looks the same.
 */
export function PageShell({ children, tone = 'calm', back }: { children: ReactNode; tone?: 'bold' | 'calm'; back?: { href: string; label: string } }) {
  const t = useT();
  const role = roleOfPath(usePathname());
  const roleLabel = ROLE_LABEL[role] === undefined ? undefined : t(ROLE_LABEL[role]);
  const shellClass = [styles.shell, tone === 'bold' ? styles.bold : styles.calm, styles[role]].join(' ');
  return (
    <main className={shellClass} style={ROLE_VARS[role]}>
      <div className={styles.inner}>
        <header className={styles.topbar}>
          <Link href="/" className={styles.brand} aria-label={t('DuoKeys — choose who is playing')}>
            <Logo size={36} />
          </Link>
          {roleLabel ? (
            <Link href={`/${role}`} className={styles.rolePill}>
              {roleLabel}
            </Link>
          ) : null}
        </header>
        {back ? (
          <Link href={back.href} className={styles.back}>
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        ) : null}
        {children}
      </div>
    </main>
  );
}
