// US-3.21 — the DuoKeys brand mark from the Design Reference (TA-APP-006):
// the Duet screen's split keybed — indigo half (adult), amber half (child),
// a thin coral seam, and a dark notch for a black key. The notch drops off
// below ~24px, as the usage notes say.

export function LogoMark({ size = 36, hasNotch = true }: { size?: number; hasNotch?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect x="4" y="6" width="15" height="28" rx="6" fill="#3D5A7C" />
      <rect x="21" y="6" width="15" height="28" rx="6" fill="#E19B34" />
      <rect x="18.5" y="6" width="3" height="28" rx="1.5" fill="#DD6E4B" />
      {hasNotch && size >= 24 ? <rect x="14" y="6" width="12" height="15" rx="3" fill="#24262B" /> : null}
    </svg>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
      <LogoMark size={size} />
      <span
        style={{
          fontFamily: 'var(--display)',
          fontWeight: 800,
          fontSize: `${Math.round(size * 0.62)}px`,
          letterSpacing: '-0.01em',
          color: 'var(--app-ink)',
        }}
      >
        DuoKeys
      </span>
    </span>
  );
}
