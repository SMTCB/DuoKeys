// US-3.24 / ADR-012 — stars as flat Pop glyphs instead of emoji: always a row of
// three, earned ones filled mustard, the rest left as ink outlines. The count is
// in the accessible label, so the fill is never the only signal (NFR-008).

const STAR_PATH = 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5-4.9-4.6 6.6-.8z';

import { useT } from '../i18n/useT';

export function StarRow({
  stars,
  size = 20,
  className,
}: {
  stars: number;
  size?: number;
  className?: string | undefined;
}) {
  const t = useT();
  return (
    <span className={className} role="img" aria-label={t('{stars} of 3 stars', { stars })}>
      {[0, 1, 2].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d={STAR_PATH}
            fill={n < stars ? 'var(--mustard)' : 'none'}
            stroke="var(--app-ink)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
