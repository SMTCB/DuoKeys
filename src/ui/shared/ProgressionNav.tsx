// FR-STU-015 — "where am I in the progression": one chip per chord, the one being
// played marked, finished ones ticked, and which round of the loop it is.

import styles from './ProgressionNav.module.css';

export function ProgressionNav({
  symbols,
  currentIndex,
  round,
  totalRounds,
}: {
  symbols: readonly string[];
  currentIndex: number;
  round: number;
  totalRounds: number;
}) {
  return (
    <ol className={styles.nav} aria-label="Progression">
      {symbols.map((symbol, i) => {
        const state = i === currentIndex ? styles.current : i < currentIndex ? styles.done : '';
        return (
          <li key={i} className={[styles.chip, state].filter(Boolean).join(' ')} {...(i === currentIndex ? { 'aria-current': 'step' as const } : {})}>
            {i < currentIndex && <span aria-hidden="true">✓</span>}
            {symbol}
          </li>
        );
      })}
      {totalRounds > 1 && (
        <li className={styles.round}>
          Round {round} of {totalRounds}
        </li>
      )}
    </ol>
  );
}
