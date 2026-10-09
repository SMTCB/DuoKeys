// US-3.21 — the DuoKeys brand mark (TA-APP-006), shown in PageShell and as the
// favicon (src/app/icon.svg). US-3.23 / ADR-012 — Pop palette, wordmark in the
// display face, following the page ground (--on-ground) so it reads on the
// cornflower Studio home.
// US-3.24 follow-up — the key tile: three white keys and two black keys in a
// cream tile, the outer keys cornflower (Studio, the adult) and mustard
// (Explorer, the child) sharing one keyboard. Replaces the split keybed, whose
// two rounded halves read as something other than a keyboard. It holds at 16 px.

const INK = '#380D02';

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="32" height="32" rx="9" fill="#FFF8E8" stroke={INK} strokeWidth="2.5" />
      <path d="M5.3 13 a7.7 7.7 0 0 1 7.7 -7.7 H14.7 V34.7 H13 a7.7 7.7 0 0 1 -7.7 -7.7Z" fill="#4A72AF" />
      <path d="M25.3 5.3 H27 a7.7 7.7 0 0 1 7.7 7.7 V27 a7.7 7.7 0 0 1 -7.7 7.7 H25.3Z" fill="#FCD77A" />
      <line x1="14.7" y1="5" x2="14.7" y2="35" stroke={INK} strokeWidth="2" />
      <line x1="25.3" y1="5" x2="25.3" y2="35" stroke={INK} strokeWidth="2" />
      <rect x="11.2" y="4" width="7" height="17" rx="2" fill={INK} />
      <rect x="21.8" y="4" width="7" height="17" rx="2" fill={INK} />
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.55rem' }}>
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: 'var(--display)',
          fontSize: `${Math.round(size * 0.66)}px`,
          letterSpacing: '0.01em',
          color: 'var(--on-ground, var(--app-ink))',
        }}
      >
        DuoKeys
      </span>
    </span>
  );
}
