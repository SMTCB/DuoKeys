// TA-CNT-001 stage 5 — fallback segmentation only (phrase-boundary detection
// is out of scope this slice): fixed-length quest sections plus one
// whole-piece reward section, matching the pattern the hand-authored Mary
// Had a Little Lamb arrangement used before it went through ingest.

import { PPQ, asTicks, type Ticks } from '../time/types';
import type { Section } from './types';

export function segmentFallback(
  totalTicks: Ticks,
  timeSig: readonly [number, number],
  pieceTitle: string,
  barsPerQuest = 2,
): Section[] {
  const [beatsPerBar, beatUnit] = timeSig;
  const ticksPerBar = beatsPerBar * PPQ * (4 / beatUnit);
  const total = totalTicks as number;
  if (total % ticksPerBar !== 0) {
    throw new Error(
      `segmentFallback: total duration ${total} ticks is not a whole number of ${ticksPerBar}-tick bars`,
    );
  }
  const totalBars = total / ticksPerBar;
  if (totalBars % barsPerQuest !== 0) {
    throw new Error(
      `segmentFallback: ${totalBars} bars is not a multiple of ${barsPerQuest}-bar quest sections`,
    );
  }

  const sections: Section[] = [];
  for (let barStart = 0; barStart < totalBars; barStart += barsPerQuest) {
    const barEnd = barStart + barsPerQuest;
    sections.push({
      id: `bars-${barStart + 1}-${barEnd}`,
      label: `Bars ${barStart + 1}–${barEnd}`,
      startTick: asTicks(barStart * ticksPerBar),
      endTick: asTicks(barEnd * ticksPerBar),
      barRange: [barStart + 1, barEnd],
      kind: 'quest',
    });
  }
  sections.push({
    id: 'whole-piece',
    label: pieceTitle,
    startTick: asTicks(0),
    endTick: totalTicks,
    barRange: [1, totalBars],
    kind: 'reward',
  });
  return sections;
}
