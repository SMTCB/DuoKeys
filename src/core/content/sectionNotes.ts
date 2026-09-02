// TA-DAT-001 — restricts a track's notes to those falling within one Section,
// half-open [startTick, endTick), so quest play (US-2.11) can match/render
// only the notes for the targeted section instead of the whole track.

import type { ContentNote, Section } from './types';

export function notesInSection(notes: readonly ContentNote[], section: Section): ContentNote[] {
  return notes.filter(
    (n) =>
      (n.startTick as number) >= (section.startTick as number) &&
      (n.startTick as number) < (section.endTick as number),
  );
}
