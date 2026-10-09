import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { localeFromLanguageTag, pitchName, translate, translatorFor } from './translate';
import { translateInstrument, translateSongTitle } from './songTitle';
import { PT } from './pt';

describe('translate', () => {
  it('returns the English text for en and for unknown keys', () => {
    expect(translate('en', 'Free play')).toBe('Free play');
    expect(translate('pt', 'No such phrase anywhere')).toBe('No such phrase anywhere');
  });

  it('translates known keys and interpolates params', () => {
    expect(translate('pt', 'Free play')).toBe('Tocar livremente');
    expect(translate('en', 'Key of {key}', { key: 'C' })).toBe('Key of C');
    expect(translatorFor('pt')('Key of {key}', { key: 'Dó' })).toContain('Dó');
  });

  it('translates data-borne strings with numbers through patterns', () => {
    expect(translate('pt', 'Bars 1–4')).toBe('Compassos 1–4');
    expect(translate('pt', 'Hanon No. 1')).toBe('Hanon n.º 1');
    expect(translate('pt', 'Hanon-style Exercise 3 (approximate)')).toBe('Exercício estilo Hanon 3 (aproximado)');
    expect(translate('pt', 'C major')).toBe('C maior');
  });
});

describe('localeFromLanguageTag', () => {
  it('picks pt for any Portuguese tag and en otherwise', () => {
    expect(localeFromLanguageTag('pt-BR')).toBe('pt');
    expect(localeFromLanguageTag('PT')).toBe('pt');
    expect(localeFromLanguageTag('en-GB')).toBe('en');
    expect(localeFromLanguageTag(undefined)).toBe('en');
  });
});

describe('pitchName', () => {
  it('uses solfège in Portuguese and letters in English', () => {
    expect(pitchName('pt', 60, false)).toBe('Dó');
    expect(pitchName('en', 60, false)).toBe('C');
  });
});

describe('translateSongTitle / translateInstrument', () => {
  it('leaves English and unknown titles alone', () => {
    expect(translateSongTitle('en', 'Morning Window')).toBe('Morning Window');
    expect(translateSongTitle('pt', 'Prelude in C')).toBe('Prelude in C');
  });

  it('renders generated titles noun-first in Portuguese', () => {
    expect(translateSongTitle('pt', 'Morning Window')).toMatch(/^Janela /);
  });

  it('translates instrument lines word by word', () => {
    expect(translateInstrument('for Harpsichord')).toBe('para Cravo');
  });
});

describe('coverage', () => {
  it('has a Portuguese entry for every literal passed to t()', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && !/i18n[\\/]pt/.test(path)) files.push(path);
      }
    };
    walk(join(process.cwd(), 'src'));
    const re = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
    const missing = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(re)) {
        const key = (m[1] ?? m[2] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"');
        if (PT[key] === undefined && translate('pt', key) === key) missing.add(key);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
