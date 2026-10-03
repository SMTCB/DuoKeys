// US-3.16 — pill button. Explorer reuses this with the amber accent,
// Studio with indigo, shared surfaces with the coral brand default.

import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

export type ButtonAccent = 'amber' | 'indigo' | 'coral';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  accent?: ButtonAccent;
}

const ACCENT_VARS: Record<ButtonAccent, { deep: string; tint: string }> = {
  amber: { deep: 'var(--amber-deep)', tint: 'var(--amber-tint)' },
  indigo: { deep: 'var(--indigo-deep)', tint: 'var(--indigo-tint)' },
  coral: { deep: 'var(--coral-deep)', tint: 'var(--coral-tint)' },
};

export function Button({ variant = 'primary', accent = 'coral', className, style, ...rest }: ButtonProps) {
  const { deep, tint } = ACCENT_VARS[accent];
  return (
    <button
      className={[styles.button, variant === 'primary' ? styles.primary : styles.secondary, className]
        .filter(Boolean)
        .join(' ')}
      style={{ ['--accent-deep' as string]: deep, ['--accent-tint' as string]: tint, ...style }}
      {...rest}
    />
  );
}
