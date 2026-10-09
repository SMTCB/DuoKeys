// Portuguese (Brazil) dictionary, keyed by the English source text (FR-SYS-009).
// Split by area so each file stays reviewable; a test asserts every literal
// passed to t() has an entry here.

import { PT_SHARED } from './pt/shared';
import { PT_EXPLORER } from './pt/explorer';
import { PT_STUDIO } from './pt/studio';
import { PT_CONTENT } from './pt/content';

export const PT: Readonly<Record<string, string>> = {
  ...PT_SHARED,
  ...PT_EXPLORER,
  ...PT_STUDIO,
  ...PT_CONTENT,
};

/** Data-borne labels with numbers in them: [pattern over the English text, PT template using $1, $2]. */
export const PT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^Bars (\d+)–(\d+)$/, 'Compassos $1–$2'],
  [/^(\d+) ms ahead of the beat$/, '$1 ms adiantado em relação ao tempo'],
  [/^(\d+) ms behind the beat$/, '$1 ms atrasado em relação ao tempo'],
  [/^1 note cut short — try holding a little longer\.$/, '1 nota cortada cedo — tente segurar um pouco mais.'],
  [/^(\d+) notes cut short — try holding a little longer\.$/, '$1 notas cortadas cedo — tente segurar um pouco mais.'],
  [/^1 note held too long — try releasing a little sooner\.$/, '1 nota segurada demais — tente soltar um pouco antes.'],
  [/^(\d+) notes held too long — try releasing a little sooner\.$/, '$1 notas seguradas demais — tente soltar um pouco antes.'],
  [/^Hanon No\. (\d+)$/, 'Hanon n.º $1'],
  [/^Hanon-style Exercise (\d+) \(approximate\)$/, 'Exercício estilo Hanon $1 (aproximado)'],
  [/^Unsupported MIDI file format (\d+)$/, 'Formato de arquivo MIDI $1 não aceito'],
  [/^"(.+)" is not a chord$/, '"$1" não é um acorde'],
  [/^Don't know the chord type "(.+)" in "(.+)"$/, 'Não conheço o tipo de acorde "$1" em "$2"'],
  [/^([A-G][#b♯♭]?) major$/, '$1 maior'],
  [/^([A-G][#b♯♭]?) minor$/, '$1 menor'],
];
