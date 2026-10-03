// TA-PORT-003 v1 adapter for ContentBackend — fetch + cache. Reads the static
// JSON emitted by content/build/ingest.ts (TA-CNT-001) under public/content/;
// the licence gate and difficulty scoring already happened at build time
// (TA-CNT-005, TA-CNT-002), so this adapter does no validation of its own.
//
// The index.json shape read here is duplicated (not imported) in
// content/build/ingest.ts, which writes it — keep the two shapes in sync by
// hand if either changes.

import type { ArrangementId, ContentBackend, ContentIndex } from '../ports';
import type { Arrangement } from '../../core/content/types';

interface ContentIndexFile extends ContentIndex {
  arrangements: { id: string; path: string }[];
}

export class StaticContentBackend implements ContentBackend {
  private indexPromise: Promise<ContentIndexFile> | undefined;

  private loadIndex(): Promise<ContentIndexFile> {
    this.indexPromise ??= fetch('/content/index.json').then((res) => {
      if (!res.ok) {
        throw new Error(
          `StaticContentBackend: could not load /content/index.json (${res.status}) — run "npm run content:build"?`,
        );
      }
      return res.json() as Promise<ContentIndexFile>;
    });
    return this.indexPromise;
  }

  async index(): Promise<ContentIndex> {
    const index = await this.loadIndex();
    return { pieces: index.pieces };
  }

  async arrangement(id: ArrangementId): Promise<Arrangement> {
    const index = await this.loadIndex();
    const entry = index.arrangements.find((a) => a.id === id);
    if (!entry) throw new Error(`StaticContentBackend: no arrangement with id "${id}"`);
    const res = await fetch(entry.path);
    if (!res.ok) {
      throw new Error(`StaticContentBackend: could not load "${entry.path}" (${res.status})`);
    }
    return res.json() as Promise<Arrangement>;
  }
}
