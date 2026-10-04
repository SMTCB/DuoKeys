// FR-STU-015 — which chord of the progression, and which round, the matcher is on.
// Pure: the markers say where each chord starts; the matcher's group index says
// where the player is.

import type { ChordMarker, ContentNote } from './types';

export interface ProgressionPosition {
  chordIndex: number;
  round: number;
  totalRounds: number;
}

export function progressionPosition(
  markers: readonly ChordMarker[],
  notes: readonly ContentNote[],
  groupIndex: number,
  chordCount: number,
): ProgressionPosition | undefined {
  if (chordCount === 0 || markers.length === 0) return undefined;
  const firstTickOfGroup: number[] = [];
  const seen = new Set<string>();
  for (const n of [...notes].sort((a, b) => (a.startTick as number) - (b.startTick as number))) {
    if (seen.has(n.groupId)) continue;
    seen.add(n.groupId);
    firstTickOfGroup.push(n.startTick as number);
  }
  const tick = firstTickOfGroup[Math.min(groupIndex, firstTickOfGroup.length - 1)];
  if (tick === undefined) return undefined;
  let markerIndex = 0;
  markers.forEach((m, i) => {
    if ((m.atTick as number) <= tick) markerIndex = i;
  });
  return {
    chordIndex: markerIndex % chordCount,
    round: Math.floor(markerIndex / chordCount) + 1,
    totalRounds: Math.max(1, Math.floor(markers.length / chordCount)),
  };
}
