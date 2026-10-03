/**
 * FR-STU-016 — emits the song library from the Mutopia mirror in content/sources/mutopia/.
 *
 *   tsx content/build/ingestSongs.ts                   build: assert every piece has a licence entry
 *   tsx content/build/ingestSongs.ts --write-licences  one-off: add the missing entries to content/licences.json
 *
 * Output (public/content is gitignored):
 *   public/content/songs/index.json       the searchable index (SongIndex)
 *   public/content/songs/mid/<id>.mid     the mirrored MIDI files, copied unmodified
 *
 * The licence gate (TA-CNT-005) fails the build on a piece without an entry, same as every other content.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSmf } from '../../src/core/midi/smf';
import { assertLicenced, type LicenceEntry } from '../../src/core/content/licence';
import { smfToArrangement, type SongEntry } from '../../src/core/content/songLibrary';
import { isSoloKeyboard } from './fetchMutopiaMidi';
import type { MutopiaRecord } from './crawlMutopia';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const P = (...parts: string[]): string => resolve(ROOT, ...parts);
const VERIFIED_DATE = '2026-10-03';

function licenceStatus(label: string): LicenceEntry['status'] {
  if (/public domain/i.test(label)) return 'public-domain';
  if (/share\s?alike/i.test(label)) return 'cc-by-sa';
  if (/zero|cc0/i.test(label)) return 'cc0';
  return 'cc-by';
}

const licenceIdOf = (r: MutopiaRecord): string => `mutopia-${r.id}`;
const sourceUrlOf = (r: MutopiaRecord): string => `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${r.id}`;

function loadRecords(): MutopiaRecord[] {
  const all = JSON.parse(readFileSync(P('content/sources/mutopia/index.json'), 'utf8')) as MutopiaRecord[];
  return all.filter((r) => isSoloKeyboard(r.instrument) && existsSync(P(`content/sources/mutopia/mid/${r.id}.mid`)));
}

function writeLicences(records: MutopiaRecord[]): void {
  const path = P('content/licences.json');
  const licences = JSON.parse(readFileSync(path, 'utf8')) as LicenceEntry[];
  const have = new Set(licences.map((l) => l.licenceId));
  let added = 0;
  for (const r of records) {
    const licenceId = licenceIdOf(r);
    if (have.has(licenceId)) continue;
    licences.push({
      licenceId,
      work: `${r.title} — ${r.composer}${r.arranger ? `, ${r.arranger}` : ''} (Mutopia Project; ${r.licence})`,
      status: licenceStatus(r.licence),
      sourceUrl: sourceUrlOf(r),
      verifiedDate: VERIFIED_DATE,
    });
    added += 1;
  }
  writeFileSync(path, JSON.stringify(licences, null, 2) + '\n');
  console.log(`licences: added ${added}, total ${licences.length}`);
}

function main(): void {
  const records = loadRecords();
  if (process.argv.includes('--write-licences')) writeLicences(records);

  const licences = JSON.parse(readFileSync(P('content/licences.json'), 'utf8')) as LicenceEntry[];
  const outDir = P('public/content/songs');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(resolve(outDir, 'mid'), { recursive: true });

  const songs: SongEntry[] = [];
  const skipped: string[] = [];
  for (const r of records) {
    const licenceId = licenceIdOf(r);
    // TA-CNT-005 — fails the build on a missing, or incompletely documented, licence entry.
    const licence = assertLicenced(licenceId, licences);
    if (!licence.sourceUrl || !licence.verifiedDate) {
      throw new Error(`licence entry "${licenceId}" is missing a sourceUrl or verifiedDate`);
    }
    const bytes = new Uint8Array(readFileSync(P(`content/sources/mutopia/mid/${r.id}.mid`)));
    const parsed = parseSmf(bytes);
    if (!parsed.ok) {
      skipped.push(`${r.id}: ${parsed.error}`);
      continue;
    }
    const id = `mutopia-${r.id}`;
    const arrangement = smfToArrangement(parsed.file, { id, title: r.title });
    if (!arrangement) {
      skipped.push(`${r.id}: no notes`);
      continue;
    }
    copyFileSync(P(`content/sources/mutopia/mid/${r.id}.mid`), resolve(outDir, 'mid', `${id}.mid`));
    songs.push({
      id,
      title: r.title,
      composer: r.composer,
      opus: r.opus,
      style: r.style,
      instrument: r.instrument.replace(/^for\s+/i, ''),
      licenceId,
      licenceLabel: r.licence,
      licenceUrl: r.licenceUrl,
      sourceUrl: sourceUrlOf(r),
      noteCount: arrangement.tracks[0]?.notes.length ?? 0,
      bars: arrangement.sections[0]?.barRange[1] ?? 1,
      bpm: arrangement.tempoMap[0]?.bpm ?? 100,
    });
  }

  songs.sort((a, b) => a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title));
  writeFileSync(resolve(outDir, 'index.json'), JSON.stringify({ songs }));
  console.log(`songs: ${songs.length} written, ${skipped.length} skipped`);
  for (const s of skipped) console.log(`  skipped ${s}`);
}

main();
