#!/usr/bin/env tsx
/**
 * content/build/importChordStyles.ts — one-off import of the rhythmic style
 * MIDI files from an unzipped ldrolez/free-midi-chords release (MIT).
 *
 * Copies the reference-key files (C for Major/Modal, A for Minor) of the four
 * style folders into content/chord-styles/<style>/<mode>/<tokens>.mid, which
 * is committed; ingestChords.ts then publishes them under public/. Every other
 * key in the release is the same file shifted, so the app transposes instead.
 *
 * Run: tsx content/build/importChordStyles.ts "<path to the unzipped release>"
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = process.argv[2];
if (!source) {
  console.error('usage: tsx content/build/importChordStyles.ts "<unzipped release folder>"');
  process.exit(1);
}

const STYLES: Record<string, string> = { pop: 'pop style', pop2: 'pop2 style', soul: 'soul style', hiphop2: 'hiphop2 style' };
const SETS: Record<string, string> = { major: 'Major', minor: 'Minor', modal: 'Modal' };
const referenceFolder = readdirSync(source).find((d) => /^01 - /.test(d));
if (!referenceFolder) {
  console.error('no "01 - C Major - A minor" folder in the release');
  process.exit(1);
}

let copied = 0;
for (const [styleId, styleFolder] of Object.entries(STYLES)) {
  for (const [mode, setFolder] of Object.entries(SETS)) {
    const dir = join(source, referenceFolder, '4 Progression', setFolder, styleFolder);
    if (!existsSync(dir)) continue;
    const outDir = resolve(root, 'content/chord-styles', styleId, mode);
    mkdirSync(outDir, { recursive: true });
    const seen = new Set<string>();
    for (const file of readdirSync(dir).sort()) {
      const match = /^[A-G][b#]? - (.+) - [^-]+\.mid$/.exec(file);
      if (!match) continue;
      const name = match[1]!.split(' ').join('-');
      // Two files can share chords under different moods; the repeat is the "~2" progression.
      const target = seen.has(name) ? `${name}~2` : name;
      seen.add(name);
      copyFileSync(join(dir, file), join(outDir, `${target}.mid`));
      copied++;
    }
  }
}
console.log(`importChordStyles — copied ${copied} files into content/chord-styles/`);
