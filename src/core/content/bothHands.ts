// A piece read from a score has a right-hand and a left-hand track and nothing to practise both
// at once. This adds the `both` track a library song already has: every note of the two hands,
// regrouped by start tick so a chord split across the hands is one decision in wait mode.

import type { Arrangement, ContentNote, Track } from './types';

export function withBothHands(arrangement: Arrangement): Arrangement {
  if (arrangement.tracks.some((t) => t.id === 'both')) return arrangement;
  const hands = arrangement.tracks.filter((t) => t.hand !== undefined);
  if (hands.length < 2) return arrangement;

  const notes: ContentNote[] = hands
    .flatMap((t) => t.notes.map((n) => ({ note: n, hand: t.hand })))
    .sort((a, b) => (a.note.startTick as number) - (b.note.startTick as number) || (a.note.pitch as number) - (b.note.pitch as number))
    .map(({ note, hand }, i) => ({
      ...note,
      id: `b${i}`,
      groupId: `t${note.startTick as number}`,
      trackId: 'both',
      ...(hand ? { hand } : {}),
    }));
  const both: Track = { id: 'both', role: 'melody', notes };
  return { ...arrangement, tracks: [...arrangement.tracks, both] };
}
