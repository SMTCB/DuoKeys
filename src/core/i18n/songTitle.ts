// Portuguese rendering of a generated song title (FR-SYS-009). The English title is "Adjective Noun";
// Portuguese puts the adjective after the noun and agrees with its gender, so it cannot be a phrase table.

import type { Locale } from './translate';

const NOUNS: Readonly<Record<string, readonly [string, 'm' | 'f']>> = {
  Window: ['Janela', 'f'],
  Road: ['Estrada', 'f'],
  Light: ['Luz', 'f'],
  Harbour: ['Porto', 'm'],
  Garden: ['Jardim', 'm'],
  Letter: ['Carta', 'f'],
  River: ['Rio', 'm'],
  Sky: ['Céu', 'm'],
  Tide: ['Maré', 'f'],
  Song: ['Canção', 'f'],
  Kitchen: ['Cozinha', 'f'],
  Lantern: ['Lanterna', 'f'],
  Hill: ['Colina', 'f'],
};

/** [masculine, feminine]; one entry when the form does not change. */
const ADJECTIVES: Readonly<Record<string, readonly [string, string?]>> = {
  Morning: ['da Manhã'],
  Open: ['Aberto', 'Aberta'],
  Rising: ['Nascente'],
  First: ['Primeiro', 'Primeira'],
  Candle: ['à Luz de Velas'],
  Slow: ['Lento', 'Lenta'],
  Velvet: ['Aveludado', 'Aveludada'],
  Moonlit: ['Enluarado', 'Enluarada'],
  Old: ['Velho', 'Velha'],
  Faded: ['Desbotado', 'Desbotada'],
  Distant: ['Distante'],
  Sunday: ['de Domingo'],
  Bright: ['Brilhante'],
  Sunny: ['Ensolarado', 'Ensolarada'],
  Dancing: ['Dançante'],
  Summer: ['de Verão'],
  Grey: ['Cinzento', 'Cinzenta'],
  Quiet: ['Quieto', 'Quieta'],
  Rainy: ['Chuvoso', 'Chuvosa'],
  Late: ['Tardio', 'Tardia'],
  Still: ['Calmo', 'Calma'],
  Gentle: ['Suave'],
  Evening: ['da Noite'],
  Soft: ['Macio', 'Macia'],
  Hidden: ['Escondido', 'Escondida'],
  Midnight: ['de Meia-noite'],
  Secret: ['Secreto', 'Secreta'],
  Misty: ['Nebuloso', 'Nebulosa'],
  Little: ['Pequeno', 'Pequena'],
  Warm: ['Quente'],
  Small: ['Pequeno', 'Pequena'],
  Wandering: ['Errante'],
  Simple: ['Simples'],
  Easy: ['Fácil'],
  Blue: ['Azul'],
};

/** "Morning Window" → "Janela da Manhã" in Portuguese; any other title is returned unchanged. */
export function translateSongTitle(locale: Locale, title: string): string {
  if (locale !== 'pt') return title;
  const [adjective, noun, ...rest] = title.split(' ');
  const n = noun === undefined ? undefined : NOUNS[noun];
  const a = adjective === undefined ? undefined : ADJECTIVES[adjective];
  if (rest.length > 0 || !n || !a) return title;
  return `${n[0]} ${(n[1] === 'f' ? a[1] : undefined) ?? a[0]}`;
}

const INSTRUMENT_WORDS: Readonly<Record<string, string>> = {
  for: 'para',
  and: 'e',
  or: 'ou',
  Harpsichord: 'Cravo',
  Clavichord: 'Clavicórdio',
  Piano: 'Piano',
  Organ: 'Órgão',
  Orgue: 'Órgão',
  Voice: 'Voz',
  Voices: 'Vozes',
  Duet: 'a quatro mãos',
  Clarinet: 'Clarinete',
  Flute: 'Flauta',
  Horn: 'Trompa',
  Violin: 'Violino',
  Cello: 'Violoncelo',
  Trumpet: 'Trompete',
  Percussion: 'Percussão',
  Orchestra: 'Orquestra',
  Quartet: 'Quarteto',
  Choir: 'Coro',
  Ensemble: 'Conjunto',
  Bass: 'Baixo',
  Baritone: 'Barítono',
};

/** Mutopia's "for Harpsichord, Piano" instrument line in Portuguese; unknown words are kept as they are. */
export function translateInstrument(text: string): string {
  return text
    .replace('Mixed Voices', 'Vozes mistas')
    .replace(/[A-Za-z]+/g, (word) => INSTRUMENT_WORDS[word] ?? word);
}
