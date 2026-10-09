// FR-SYS-009 — the chosen language. localStorage is a per-device convenience
// (wrapped in try/catch: it can be blocked); with nothing stored we follow the
// browser language. Applied after mount so server and first client render agree.

import { create } from 'zustand';
import { DEFAULT_LOCALE, isLocale, localeFromLanguageTag, type Locale } from '../../core/i18n/translate';

const STORAGE_KEY = 'duokeys.locale';

interface LocaleState {
  locale: Locale;
  isResolved: boolean;
  /** Read the stored choice (or browser language) once, after mount. */
  resolve(): void;
  setLocale(locale: Locale): void;
}

function applyToDocument(locale: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = locale === 'pt' ? 'pt-BR' : 'en';
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: DEFAULT_LOCALE,
  isResolved: false,
  resolve() {
    if (get().isResolved) return;
    let locale: Locale = DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      locale = isLocale(stored) ? stored : localeFromLanguageTag(window.navigator.language);
    } catch {
      locale = localeFromLanguageTag(typeof navigator === 'undefined' ? '' : navigator.language);
    }
    applyToDocument(locale);
    set({ locale, isResolved: true });
  },
  setLocale(locale) {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* per-device convenience only */
    }
    applyToDocument(locale);
    set({ locale, isResolved: true });
  },
}));
