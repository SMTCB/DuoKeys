// One-off crawl of Mutopia's piano listing -> content/sources/mutopia/index.json.
// Run: tsx content/build/crawlMutopia.ts   (about 150 polite requests; safe to re-run)
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://www.mutopiaproject.org/cgibin/make-table.cgi?Instrument=Piano&preview=0&startat=';
const PAGE = 10;
const DELAY_MS = 400;

export interface MutopiaRecord {
  id: number;
  title: string;
  composer: string;
  opus: string;
  instrument: string;
  style: string;
  arranger: string;
  source: string;
  licence: string;
  licenceUrl: string;
  midUrl: string;
  pdfUrl: string;
  dateAdded: string;
}

const strip = (s: string): string =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

function parseBlock(block: string): MutopiaRecord | undefined {
  const cells = [...block.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => m[1] ?? '');
  const id = /piece-info\.cgi\?id=(\d+)/.exec(block)?.[1];
  const mid = /href="(https:\/\/www\.mutopiaproject\.org\/ftp\/[^"]+\.mid)"/.exec(block)?.[1];
  if (!id || !mid) return undefined;
  const licenceMatch = /<a href="\.\.\/legal\.html#([^"]+)">([^<]+)<\/a>/.exec(block);
  const pdf = /href="(https:\/\/www\.mutopiaproject\.org\/ftp\/[^"]+-a4\.pdf)"/.exec(block)?.[1] ?? '';
  const c = (i: number): string => strip(cells[i] ?? '');
  // cell layout (three rows of four, preview=0): 0 title, 1 composer, 2 opus, 3 -, 4 instrument,
  // 5 year, 6 style, 7 arranger, 8 source, 9 licence, 10 more info, 11 date
  return {
    id: Number(id),
    title: c(0),
    composer: c(1).replace(/^by\s+/i, ''),
    opus: c(2),
    instrument: c(4),
    style: c(6),
    arranger: c(7),
    source: c(8),
    licence: licenceMatch ? strip(licenceMatch[2] ?? '') : '',
    licenceUrl: licenceMatch ? `https://www.mutopiaproject.org/legal.html#${licenceMatch[1]}` : '',
    midUrl: mid,
    pdfUrl: pdf,
    dateAdded: c(11),
  };
}

async function main(): Promise<void> {
  const out = new Map<number, MutopiaRecord>();
  for (let start = 0; ; start += PAGE) {
    const res = await fetch(BASE + start);
    if (!res.ok) throw new Error(`HTTP ${res.status} at ${start}`);
    const html = await res.text();
    const blocks = html.split('<table class="table-bordered result-table">').slice(1);
    if (blocks.length === 0) break;
    for (const b of blocks) {
      const rec = parseBlock(b);
      if (rec) out.set(rec.id, rec);
    }
    if (start % 200 === 0) console.log(`startat=${start} total=${out.size}`);
    if (blocks.length < PAGE) break;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  const records = [...out.values()].sort((a, b) => a.id - b.id);
  mkdirSync('content/sources/mutopia', { recursive: true });
  writeFileSync('content/sources/mutopia/index.json', JSON.stringify(records, null, 1));
  console.log(`wrote ${records.length} records`);
}

void main();
