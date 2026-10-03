// FR-STU-016 loader for the song library (Mutopia mirror). Like staticChords.ts it is a
// standalone function rather than a ContentBackend method: songs are an index of MIDI
// files, not Pieces with authored Arrangements.
//
// Reads content/build/ingestSongs.ts's output at public/content/songs/.

import type { SongIndex } from '../../core/content/songLibrary';

let indexPromise: Promise<SongIndex> | undefined;

export function loadSongIndex(): Promise<SongIndex> {
  indexPromise ??= fetch('/content/songs/index.json').then((res) => {
    if (!res.ok) {
      throw new Error(`loadSongIndex: could not load /content/songs/index.json (${res.status}) — run "npm run content:build:songs"?`);
    }
    return res.json() as Promise<SongIndex>;
  });
  return indexPromise;
}

/** The .mid bytes of one song (id is `mutopia-<n>`); undefined if the file is not there. */
export async function loadSongBytes(songId: string): Promise<Uint8Array | undefined> {
  const res = await fetch(`/content/songs/mid/${encodeURIComponent(songId)}.mid`);
  if (!res.ok) return undefined;
  return new Uint8Array(await res.arrayBuffer());
}
