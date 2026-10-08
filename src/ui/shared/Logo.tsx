// US-3.21 — the DuoKeys brand mark from the Design Reference (TA-APP-006):
// the Duet screen's split keybed — Studio half (adult), Explorer half (child),
// a thin seam in the shared colour, and a dark notch for a black key. The notch
// drops off below ~24px, as the usage notes say.
// US-3.23 / ADR-012 — redrawn in the Pop palette (cornflower / mustard / tomato,
// ink notch) with the wordmark in the display face; the wordmark follows the
// page ground (--on-ground) so it reads on the cornflower Studio home.

export function LogoMark({ size = 36, hasNotch = true }: { size?: number; hasNotch?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="16" height="30" rx="7" fill="#4A72AF" stroke="#380D02" strokeWidth="2" />
      <rect x="21" y="5" width="16" height="30" rx="7" fill="#FCD77A" stroke="#380D02" strokeWidth="2" />
      <rect x="18" y="5" width="4" height="30" rx="2" fill="#EB533E" />
      {hasNotch && size >= 24 ? <rect x="14" y="5" width="12" height="15" rx="3" fill="#380D02" /> : null}
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
