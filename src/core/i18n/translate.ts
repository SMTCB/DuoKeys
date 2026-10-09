// Pure translation core (FR-SYS-009). English text is the key: a missing PT
// entry falls back to the English source, so a gap is never a blank screen.
// core/ stays free of React, DOM and storage — the locale is passed in.

import { PT, PT_PATTERNS } from './pt';

export type Locale = 'en' | 'pt';
export const LOCALES: readonly Locale[] = ['en', 'pt'];
export const DEFAULT_LOCALE: Locale = 'en';

export type TParams = Readonly<Record<string, string | number>>;

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'pt';
}

/** Browser language tag -> supported locale ("pt-BR" -> "pt"). */
export function localeFromLanguageTag(tag: string | undefined | null): Locale {
  return tag && tag.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function interpolate(template: string, params: TParams | undefined): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

export function translate(locale: Locale, key: string, params?: TParams): string {
  if (locale === 'pt') {
    const hit = PT[key];
    if (hit !== undefined) return interpolate(hit, params);
    // Text that arrives from data with a number baked in ("Bars 1–4").
    for (const [pattern, template] of PT_PATTERNS) {
      const m = pattern.exec(key);
      if (m) return interpolate(template.replace(/\$(\d)/g, (_w, i: string) => m[Number(i)] ?? ''), params);
    }
  }
  return interpolate(key, params);
}

export type Translator = (key: string, params?: TParams) => string;

export function translatorFor(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

const SOLFEGE = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'] as const;
const LETTERS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Display name of a MIDI pitch: letters in EN, solfège in PT (octave optional). */
export function pitchName(locale: Locale, midiPitch: number, withOctave: boolean): string {
  const pc = ((midiPitch % 12) + 12) % 12;
  const base = (locale === 'pt' ? SOLFEGE : LETTERS)[pc] ?? '';
  return withOctave ? `${base}${Math.floor(midiPitch / 12) - 1}` : base;
}
