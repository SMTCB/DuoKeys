// US-3.21 — a whole-card link with a picture, used for the destinations on the
// Explorer and Studio homes. The picture and the title both say what it is, so
// colour is never the only cue (NFR-008).
// US-3.23 / ADR-012 — two looks: `row` (a cream card with a Pop shape at the
// left, for lists) and `tile` (a colour block with one big rounded corner and a
// shape in its corner, for the home grids). Navigation surfaces only — never a
// practice screen.

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { PopShape, POP_FILL, POP_ON } from './PopShape';
import type { PopColour, PopShapeName } from './PopShape';
import styles from './ActionCard.module.css';

export type PopCorner = 'tl' | 'tr' | 'br' | 'bl';

export function ActionCard({
  href,
  icon,
  title,
  description,
  variant = 'row',
  colour = 'cream',
  shape,
  shapeColour = 'mustard',
  corner,
  meta,
}: {
  href: string;
  /** A short text picture (a number, a letter) drawn in the display face. */
  icon?: ReactNode;
  title: string;
  description?: string;
  variant?: 'row' | 'tile';
  /** The tile's colour block (tile) — rows are always cream. */
  colour?: PopColour;
  shape?: PopShapeName;
  shapeColour?: PopColour;
  /** Which corner gets the big Pop rounding (tiles default to top-left; rows have none unless set). */
  corner?: PopCorner;
  /** A small line under the title on a tile: stars, "New", "Locked". */
  meta?: ReactNode;
}) {
  if (variant === 'tile') {
    const style = {
      ['--tile-bg' as string]: POP_FILL[colour],
      ['--tile-on' as string]: POP_ON[colour],
    } as CSSProperties;
    return (
      <Link href={href} className={[styles.tile, styles[`corner_${corner ?? 'tl'}`]].join(' ')} style={style}>
        {shape ? <PopShape shape={shape} colour={shapeColour} size={48} className={styles.tileShape} /> : null}
        {icon !== undefined ? (
          <span className={styles.tileIcon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className={styles.tileTitle}>{title}</span>
        {description ? <span className={styles.tileDescription}>{description}</span> : null}
        {meta ? <span className={styles.tileMeta}>{meta}</span> : null}
      </Link>
    );
  }

  return (
    <Link href={href} className={[styles.card, corner ? styles[`corner_${corner}`] : undefined].filter(Boolean).join(' ')}>
      <span className={styles.icon} aria-hidden="true">
        {shape ? <PopShape shape={shape} colour={shapeColour} size={44} /> : icon}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        {description ? <span className={styles.description}>{description}</span> : null}
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </span>
      <span className={styles.arrow} aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/** A responsive grid of tiles: two across on a phone, more on a wide screen. */
export function ActionGrid({ children, min = 'pair' }: { children: ReactNode; min?: 'pair' | 'small' }) {
  return <div className={[styles.grid, min === 'small' ? styles.gridSmall : undefined].filter(Boolean).join(' ')}>{children}</div>;
}

/** A column of row cards. */
export function ActionList({ children }: { children: ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}
