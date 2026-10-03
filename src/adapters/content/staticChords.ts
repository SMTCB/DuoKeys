// TA-CNT-006 loader for the chord/progression catalogue. Fetch + cache, same
// pattern as static.ts's StaticContentBackend — but this is deliberately a
// standalone function, not a ContentBackend (TA-PORT-002) method: TA-CNT-006
// frames chord content as its own thing, not a Piece/Arrangement, so it does
// not fit the port's Piece/Arrangement-scoped surface.
//
// Reads content/build/ingestChords.ts's output at public/content/chords/index.json.

import type { ChordIndex } from '../../core/content/chordTypes';

let cataloguePromise: Promise<ChordIndex> | undefined;

export function loadChordCatalogue(): Promise<ChordIndex> {
  cataloguePromise ??= fetch('/content/chords/index.json').then((res) => {
    if (!res.ok) {
      throw new Error(
        `loadChordCatalogue: could not load /content/chords/index.json (${res.status}) — run "npm run content:build:chords"?`,
      );
    }
    return res.json() as Promise<ChordIndex>;
  });
  return cataloguePromise;
}

/** FR-STU-015 — the bytes of one rhythmic style file (path from styleFilePath). undefined if it is not there. */
export async function loadChordStyleBytes(stylePath: string): Promise<Uint8Array | undefined> {
  const url = `/content/chords/styles/${stylePath.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  if (!res.ok) return undefined;
  return new Uint8Array(await res.arrayBuffer());
}
