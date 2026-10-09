'use client';

import { useEffect, useMemo } from 'react';
import { useLocaleStore } from '../../runtime/stores/localeStore';
import { pitchName, translatorFor, type Locale, type Translator } from '../../core/i18n/translate';

/** The active locale, resolving the stored/browser choice on first use. */
export function useLocale(): Locale {
  const locale = useLocaleStore((s) => s.locale);
  const resolve = useLocaleStore((s) => s.resolve);
  useEffect(() => resolve(), [resolve]);
  return locale;
}

export function useT(): Translator {
  const locale = useLocale();
  return useMemo(() => translatorFor(locale), [locale]);
}

/** Locale-aware note names: letters in English, solfège (Dó Ré Mi) in Portuguese. */
export function useNoteName(): (pitch: number, withOctave?: boolean) => string {
  const locale = useLocale();
  return useMemo(() => (pitch, withOctave = true) => pitchName(locale, pitch, withOctave), [locale]);
}
