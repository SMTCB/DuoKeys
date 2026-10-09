'use client';

import { useLocale, useT } from './useT';
import { useLocaleStore } from '../../runtime/stores/localeStore';
import type { Locale } from '../../core/i18n/translate';

const OPTIONS: ReadonlyArray<{ locale: Locale; label: string; lang: string }> = [
  { locale: 'en', label: 'English', lang: 'en' },
  { locale: 'pt', label: 'Português', lang: 'pt-BR' },
];

/** FR-SYS-009 — language choice. Each option is named in its own language so it can be found by someone who can't read the current one. */
export function LanguageSwitch() {
  const active = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useT();
  return (
    <div role="group" aria-label={t('Language')} style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
      {OPTIONS.map((o) => (
        <button
          key={o.locale}
          type="button"
          lang={o.lang}
          aria-pressed={active === o.locale}
          onClick={() => setLocale(o.locale)}
          style={{
            font: 'inherit',
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 999,
            cursor: 'pointer',
            border: '2px solid currentColor',
            background: active === o.locale ? 'currentColor' : 'transparent',
            color: 'inherit',
          }}
        >
          <span style={active === o.locale ? { color: 'var(--bg, #fff)' } : undefined}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
