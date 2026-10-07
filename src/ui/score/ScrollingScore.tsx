// FR-STU-016 / TA-REN-003 — the music score as a strip that slides right to left, so the next
// notes always come in from the right. It is the falling-notes idea turned on its side: the
// note being waited for sits on the dashed line, played notes fade, and the strip steps along
// each time a chord is played. Both staves are shown for every track; the track being
// practised is drawn solid and the other hand lighter.

'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Arrangement, ContentNote } from '../../core/content/types';
import { detectKey } from '../../core/content/detectKey';
import {
  BASS_BOTTOM_STEP,
  TREBLE_BOTTOM_STEP,
  layoutScore,
  type PlacedNote,
  type StaffName,
} from '../../core/content/scoreLayout';
import styles from './ScrollingScore.module.css';

const SPACE = 5; // half a staff space in px: one diatonic step
const TREBLE_BOTTOM_Y = 90;
const BASS_BOTTOM_Y = 190;
const HEIGHT = 240;
const NOW_FRACTION = 0.25;
const HEAD_RX = 6;

const bottomOf = (staff: StaffName): { step: number; y: number } =>
  staff === 'treble' ? { step: TREBLE_BOTTOM_STEP, y: TREBLE_BOTTOM_Y } : { step: BASS_BOTTOM_STEP, y: BASS_BOTTOM_Y };

const yOf = (note: PlacedNote): number => {
  const b = bottomOf(note.staff);
  return b.y - (note.step - b.step) * SPACE;
};

function ledgerYs(note: PlacedNote): number[] {
  const b = bottomOf(note.staff);
  const rel = note.step - b.step; // 0 = bottom line, 8 = top line
  const ys: number[] = [];
  if (rel < 0) for (let r = -2; r >= rel - (rel % 2 === 0 ? 0 : 1); r -= 2) ys.push(b.y - r * SPACE);
  if (rel > 8) for (let r = 10; r <= rel; r += 2) ys.push(b.y - r * SPACE);
  return ys;
}

export function ScrollingScore({
  arrangement,
  trackId,
  groupIndex,
  preferSharps,
  isFinished,
  notes,
}: {
  arrangement: Arrangement;
  trackId: string;
  groupIndex: number;
  /** Spell black keys with sharps; left out, it follows the key the notes are in. */
  preferSharps?: boolean;
  isFinished: boolean;
  /** The notes the matcher is actually expecting for `trackId` (a quest section, say), if fewer than the whole track. */
  notes?: ContentNote[] | undefined;
}) {
  const shown = useMemo(
    () => (notes ? { ...arrangement, tracks: arrangement.tracks.map((t) => (t.id === trackId ? { ...t, notes } : t)) } : arrangement),
    [arrangement, trackId, notes],
  );
  const sharps = preferSharps ?? detectKey(shown)?.isSharpKey ?? true;
  const layout = useMemo(() => layoutScore(shown, trackId, sharps), [shown, trackId, sharps]);
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(640);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = (): void => setFrameWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const lastTick = layout.groupTicks[layout.groupTicks.length - 1] ?? 0;
  const currentTick = isFinished ? lastTick + 1 : (layout.groupTicks[groupIndex] ?? lastTick + 1);
  const nowX = layout.xOfTick(isFinished ? lastTick + 480 : currentTick);
  const offset = Math.max(0, nowX - frameWidth * NOW_FRACTION - 20);

  return (
    <div ref={frameRef} className={styles.frame} role="img" aria-label="The music score, moving along as you play">
      <svg
        className={styles.strip}
        width={layout.widthPx}
        height={HEIGHT}
        viewBox={`0 0 ${layout.widthPx} ${HEIGHT}`}
        style={{ transform: `translateX(${-offset}px)` }}
      >
        {([['treble', TREBLE_BOTTOM_Y], ['bass', BASS_BOTTOM_Y]] as const).map(([staff, bottomY]) => (
          <g key={staff}>
            {[0, 1, 2, 3, 4].map((i) => (
              <line key={i} className={styles.line} x1={0} x2={layout.widthPx} y1={bottomY - i * 2 * SPACE} y2={bottomY - i * 2 * SPACE} />
            ))}
            <text className={styles.clef} x={offset + 8} y={bottomY - 12}>
              {staff === 'treble' ? 'Right' : 'Left'}
            </text>
          </g>
        ))}
        {layout.bars.map((bar) => (
          <g key={bar.number}>
            <line className={styles.bar} x1={bar.x - 14} x2={bar.x - 14} y1={TREBLE_BOTTOM_Y - 8 * SPACE} y2={BASS_BOTTOM_Y} />
            <text className={styles.barNumber} x={bar.x - 12} y={TREBLE_BOTTOM_Y - 8 * SPACE - 6}>
              {bar.number}
            </text>
          </g>
        ))}
        {layout.notes.map((note) => {
          const y = yOf(note);
          const x = note.x + (note.isShifted ? HEAD_RX * 2 - 1 : 0);
          const isMine = note.trackId === trackId;
          const isDone = note.startTick < currentTick;
          const isNow = isMine && note.startTick >= currentTick && note.startTick < currentTick + 30;
          const state = isNow ? styles.now : isDone ? styles.done : isMine ? '' : styles.other;
          const stemUp = note.step < bottomOf(note.staff).step + 4;
          const stemX = stemUp ? x + HEAD_RX - 0.5 : x - HEAD_RX + 0.5;
          return (
            <g key={note.id} className={state}>
              {ledgerYs(note).map((ly) => (
                <line key={ly} className={styles.line} x1={x - HEAD_RX - 4} x2={x + HEAD_RX + 4} y1={ly} y2={ly} />
              ))}
              {note.accidental && (
                <text className={styles.accidental} x={x - HEAD_RX - 13} y={y + 5}>
                  {note.accidental === 'sharp' ? '♯' : '♭'}
                </text>
              )}
              <ellipse
                className={`${styles.note} ${note.isHollow ? (isNow ? styles.nowHollow : styles.hollow) : ''}`}
                cx={x}
                cy={y}
                rx={HEAD_RX}
                ry={4.5}
                transform={`rotate(-20 ${x} ${y})`}
              />
              {note.hasStem && <line className={styles.note} x1={stemX} x2={stemX} y1={y} y2={stemUp ? y - 30 : y + 30} strokeWidth={1.2} />}
            </g>
          );
        })}
      </svg>
      <div className={styles.nowLine} style={{ left: `${nowX - offset}px` }} aria-hidden="true" />
    </div>
  );
}
