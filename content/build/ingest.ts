#!/usr/bin/env tsx
/**
 * content/build/ingest.ts — TA-CNT-001, the content pipeline.
 *
 * Reads hand-authored tune sources from content/sources/*.json plus
 * MusicXML imports from content/sources/*.musicxml (each paired with a
 * *.meta.json sidecar carrying id/tags/licenceId — MusicXML itself has no
 * field for those), licence-checks every source against
 * content/licences.json (TA-CNT-005 — fails the build on any missing,
 * unverified, or incomplete entry), normalises notes to absolute ticks,
 * groups simultaneous notes (TA-MAT-004), segments into quest/reward
 * sections (TA-CNT-001 stage 5, 2-bar fallback only this slice), scores
 * difficulty (TA-CNT-002), and emits static JSON under public/content/ for
 * StaticContentBackend to fetch (TA-PORT-003).
 *
 * Out of scope this slice: `.mxl` (zip-compressed) and `.mid` sources —
 * only uncompressed `.musicxml` is read; the MusicXML parser's own scope
 * limits (solo part, one or two staves, one voice per staff) are documented
 * in src/core/content/parseMusicXml.ts. Phrase-boundary segmentation is
 * also still unimplemented (only the 2-bar fallback exists) — see
 * docs/01-TECHNICAL-ARCHITECTURE.md TA-CNT-001.
 *
 * Run: npm run content:build
 *
 * The emitted public/content/index.json shape is duplicated (not imported)
 * in src/adapters/content/static.ts, which reads it at runtime — this file
 * writes it, that one reads it; keep the two shapes in sync by hand if either
 * changes.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLicenced, type LicenceEntry } from '../../src/core/content/licence';
import { buildArrangementFromSource, type SourceInput } from '../../src/core/content/buildArrangement';
import { parseMusicXml } from '../../src/core/content/parseMusicXml';
import { buildHanonSourceInput, HANON_PATTERNS } from '../../src/core/content/hanon';
import type { Piece } from '../../src/core/content/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const P = (p: string): string => resolve(root, p);

interface Source extends SourceInput {
  tags: string[];
  licenceId: string;
}

interface IndexFile {
  pieces: { id: string; title: string; defaultArrangementId: string }[];
  arrangements: { id: string; path: string }[];
}

function fail(message: string): never {
  console.error(`content:build — ${message}`);
  process.exit(1);
}

function loadLicences(): LicenceEntry[] {
  return JSON.parse(readFileSync(P('content/licences.json'), 'utf8')) as LicenceEntry[];
}

interface MusicXmlMeta {
  id: string;
  tags: string[];
  licenceId: string;
  title?: string;
  barsPerQuest?: number;
}

function loadJsonSources(dir: string): { file: string; source: Source }[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'))
    .sort();
  return files.map((file) => ({ file, source: JSON.parse(readFileSync(join(dir, file), 'utf8')) as Source }));
}

function loadMusicXmlSources(dir: string): { file: string; source: Source }[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.musicxml')).sort();
  return files.map((file) => {
    const metaFile = file.replace(/\.musicxml$/, '.meta.json');
    const metaPath = join(dir, metaFile);
    if (!existsSync(metaPath)) {
      throw new Error(`${file}: missing companion ${metaFile} (id, tags, licenceId — MusicXML has no field for those)`);
    }
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as MusicXmlMeta;
    const xml = readFileSync(join(dir, file), 'utf8');
    const parsed = parseMusicXml(xml, { id: meta.id, ...(meta.barsPerQuest !== undefined ? { barsPerQuest: meta.barsPerQuest } : {}) });
    const source: Source = { ...parsed, title: meta.title ?? parsed.title, tags: meta.tags, licenceId: meta.licenceId };
    return { file, source };
  });
}

function loadHanonSources(): { file: string; source: Source }[] {
  return HANON_PATTERNS.map((pattern) => ({
    file: `hanon:${pattern.id}`,
    source: { ...buildHanonSourceInput(pattern), tags: ['hanon', 'adult'], licenceId: 'hanon-virtuoso-pianist-1900' },
  }));
}

function loadSources(): { file: string; source: Source }[] {
  const dir = P('content/sources');
  return [...loadJsonSources(dir), ...loadMusicXmlSources(dir), ...loadHanonSources()];
}

function validateSource(source: Source): void {
  const required: (keyof Source)[] = ['id', 'title', 'tags', 'licenceId', 'tempoBpm', 'timeSig', 'keySig', 'tracks'];
  for (const field of required) {
    if (source[field] === undefined) throw new Error(`missing required field "${field}"`);
  }
  if (source.tracks.length === 0) throw new Error('has no tracks');
  for (const track of source.tracks) {
    if (track.notes.length === 0) throw new Error(`track "${track.id}" has no notes`);
  }
}

function main(): void {
  const licences = loadLicences();
  const sources = loadSources();
  if (sources.length === 0) fail('content/sources/ has no source files');

  const pieces: IndexFile['pieces'] = [];
  const arrangements: IndexFile['arrangements'] = [];

  for (const { file, source } of sources) {
    try {
      validateSource(source);

      // TA-CNT-005 — fails the build on a missing, or incompletely
      // documented, licence entry.
      const licenceEntry = assertLicenced(source.licenceId, licences);
      if (!licenceEntry.sourceUrl || !licenceEntry.verifiedDate) {
        throw new Error(`licence entry "${source.licenceId}" is missing a sourceUrl or verifiedDate`);
      }

      const arrangement = buildArrangementFromSource(source);
      const piece: Piece = { id: source.id, title: source.title, tags: source.tags, licenceId: source.licenceId };

      const relPath = `${piece.id}/${arrangement.id}.v1.json`;
      const outPath = P(`public/content/${relPath}`);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(arrangement, null, 2));

      pieces.push({ id: piece.id, title: piece.title, defaultArrangementId: arrangement.id });
      arrangements.push({ id: arrangement.id, path: `/content/${relPath}` });

      console.log(`ok       ${file} -> ${relPath}  (difficulty ${arrangement.difficulty})`);
    } catch (e) {
      fail(`${file}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const index: IndexFile = { pieces, arrangements };
  writeFileSync(P('public/content/index.json'), JSON.stringify(index, null, 2));
  console.log(`\ncontent:build — wrote ${sources.length} arrangement(s) + index.json`);
}

main();
