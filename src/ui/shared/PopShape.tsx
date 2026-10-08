// US-3.23 / ADR-012 — the Pop pictograms: flat geometric shapes (circle,
// square, quarter-circle, arch, half-moon) in the palette colours. They replace
// emoji as tile pictures. A shape is always paired with a title, so it is a
// second cue, never the only one (NFR-008). Decorative: hidden from assistive
// technology. Never used on a practice surface (falling notes, score, keybed).

export type PopColour = 'tomato' | 'mustard' | 'peach' | 'cornflower' | 'cream' | 'ink';
export type PopShapeName = 'circle' | 'square' | 'quarter' | 'arch' | 'half';

export const POP_FILL: Record<PopColour, string> = {
  tomato: 'var(--tomato)',
  mustard: 'var(--mustard)',
  peach: 'var(--peach)',
  cornflower: 'var(--cornflower)',
  cream: 'var(--cream)',
  ink: 'var(--app-ink)',
};

/** Text colour that passes contrast on each palette fill. */
export const POP_ON: Record<PopColour, string> = {
  tomato: 'var(--app-ink)',
  mustard: 'var(--app-ink)',
  peach: 'var(--app-ink)',
  cornflower: 'var(--cream)',
  cream: 'var(--app-ink)',
  ink: 'var(--cream)',
};

const PATHS: Record<PopShapeName, string> = {
  circle: 'M20 2a18 18 0 1 1 0 36a18 18 0 1 1 0-36z',
  square: 'M4 4h32v32H4z',
  quarter: 'M2 38V2a36 36 0 0 1 36 36z',
  arch: 'M4 38V20a16 16 0 0 1 32 0v18z',
  half: 'M2 22a18 18 0 0 0 36 0z',
};

export function PopShape({
  shape,
  colour,
  size = 40,
  className,
}: {
  shape: PopShapeName;
  colour: PopColour;
  size?: number;
  className?: string | undefined;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[shape]} fill={POP_FILL[colour]} />
    </svg>
  );
}
