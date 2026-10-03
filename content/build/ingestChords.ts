#!/usr/bin/env tsx
/**
 * content/build/ingestChords.ts — TA-CNT-006, the chord & progression content pipeline.
 *
 * Generates the chord/progression catalogue (src/core/content/chordCatalogue.ts)
 * after licence-checking it against content/licences.json, and emits static
 * JSON under public/content/chords/ for a future StaticContentBackend-style
 * fetch+cache loader (src/adapters/content/staticChords.ts) to read.
 *
 * Progression sequences and mood tags are ported as text data from
 * ldrolez/free-midi-chords (chords.py's prog_maj/prog_min lists, MIT) — see
 * the "free-midi-chords-progressions" licence entry. The actual chord
 * voicings/pitches remain this codebase's own generation from public-domain
 * chord-interval formulas and diatonic harmony (no MIDI-file binary parser
 * exists here; src/core/midi/decode.ts only decodes live Web MIDI byte
 * messages, not .mid file structure) — see "duokeys-original-chord-catalogue".
 *
 * Run: npm run content:build:chords (also chained into npm run content:build)
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLicenced, type LicenceEntry } from '../../src/core/content/licence';
import { generateChordCatalogue } from '../../src/core/content/chordCatalogue';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const P = (p: string): string => resolve(root, p);

const LICENCE_IDS = ['duokeys-original-chord-catalogue', 'free-midi-chords-progressions', 'free-midi-chords-style-midi'];

function fail(message: string): never {
  console.error(`content:build:chords — ${message}`);
  process.exit(1);
}

function loadLicences(): LicenceEntry[] {
  return JSON.parse(readFileSync(P('content/licences.json'), 'utf8')) as LicenceEntry[];
}

function main(): void {
  const licences = loadLicences();

  try {
    // TA-CNT-005 — fails the build on a missing, or incompletely documented, licence entry.
    for (const licenceId of LICENCE_IDS) {
      const licenceEntry = assertLicenced(licenceId, licences);
      if (!licenceEntry.sourceUrl || !licenceEntry.verifiedDate) {
        throw new Error(`licence entry "${licenceId}" is missing a sourceUrl or verifiedDate`);
      }
    }

    const catalogue = generateChordCatalogue();
    const outPath = P('public/content/chords/index.json');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(catalogue));

    // The rhythmic style files (FR-STU-015), published as-is for the browser to fetch and parse.
    rmSync(P('public/content/chords/styles'), { recursive: true, force: true });
    cpSync(P('content/chord-styles'), P('public/content/chords/styles'), { recursive: true });

    console.log(
      `content:build:chords — wrote ${catalogue.chords.length} chords + ${catalogue.progressions.length} progressions -> public/content/chords/index.json`,
    );
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
}

main();
