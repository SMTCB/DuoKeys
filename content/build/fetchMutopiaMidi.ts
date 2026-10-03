// One-off mirror of the Mutopia MIDI files named in content/sources/mutopia/index.json.
// Run: tsx content/build/fetchMutopiaMidi.ts   (skips files already on disk; safe to re-run)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { MutopiaRecord } from './crawlMutopia';

/** Solo keyboard pieces only: piano, harpsichord, clavichord — no voice, strings or duets. */
export function isSoloKeyboard(instrument: string): boolean {
  const parts = instrument
    .replace(/^for\s+/i, '')
    .split(/,|\band\b/i)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every((p) => ['piano', 'harpsichord', 'clavichord'].includes(p));
}

async function main(): Promise<void> {
  const records = (
    JSON.parse(readFileSync('content/sources/mutopia/index.json', 'utf8')) as MutopiaRecord[]
  ).filter((r) => isSoloKeyboard(r.instrument));
  mkdirSync('content/sources/mutopia/mid', { recursive: true });
  let fetched = 0;
  let failed = 0;
  for (const r of records) {
    const path = `content/sources/mutopia/mid/${r.id}.mid`;
    if (existsSync(path)) continue;
    try {
      const res = await fetch(r.midUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      writeFileSync(path, new Uint8Array(await res.arrayBuffer()));
      fetched += 1;
    } catch (e) {
      failed += 1;
      console.log(`FAIL ${r.id} ${r.midUrl}: ${String(e)}`);
    }
    if (fetched % 50 === 0 && fetched > 0) console.log(`fetched ${fetched}`);
    await new Promise((res) => setTimeout(res, 250));
  }
  console.log(`done: ${records.length} solo keyboard pieces, ${fetched} fetched, ${failed} failed`);
}



// Only when run directly — ingestSongs.ts imports isSoloKeyboard from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
