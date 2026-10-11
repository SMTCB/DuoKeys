// FR-STU-016 — the whole piece written out as a page of music: rows of bars, treble over bass,
// read top to bottom. It uses the same layout as the scrolling strip (ScrollingScore), so a note
// sits on the same line in both; only the arrangement into rows is new.

'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/useT';
import type { Arrangement } from '../../core/content/types';
import { detectKey } from '../../core/content/detectKey';
import { layoutScore, type PlacedNote } from '../../core/content/scoreLayout';
import { ticksPerMeasure } from '../../core/content/toMusicXml';
import { BASS_BOTTOM_Y, HEAD_RX, SPACE, TREBLE_BOTTOM_Y, bottomOf, ledgerYs, yOf } from './ScrollingScore';
import styles from './ScrollingScore.module.css';

const ROW_HEIGHT = 240;
const ROW_PAD = 36;
const MIN_BAR_PX = 230;

export function PageScore({ arrangement, preferSharps }: { arrangement: Arrangement; preferSharps?: boolean }) {
  const t = useT();
  // A `both` track repeats the two hands' notes; drawing it as well would print every note twice.
  const drawn = useMemo(() => {
    const hands = arrangement.tracks.filter((tr) => tr.id !== 'both');
    return hands.length > 0 ? { ...arrangement, tracks: hands } : arrangement;
  }, [arrangement]);
  const sharps = preferSharps ?? detectKey(drawn)?.isSharpKey ?? true;
  const layout = useMemo(() => layoutScore(drawn, drawn.tracks[0]?.id ?? '', sharps), [drawn, sharps]);

  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = (): void => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const perMeasure = Math.max(1, ticksPerMeasure(arrangement.timeSig));
  const lastStart = layout.notes.reduce((max, n) => Math.max(max, n.startTick), 0);
  const barCount = Math.floor(lastStart / perMeasure) + 1;
  const innerWidth = Math.max(MIN_BAR_PX, width - ROW_PAD * 2);
  const barsPerRow = Math.max(1, Math.floor(innerWidth / MIN_BAR_PX));
  const rows = Math.ceil(barCount / barsPerRow);

  const notesByBar = useMemo(() => {
    const byBar = new Map<number, PlacedNote[]>();
    for (const n of layout.notes) {
      const bar = Math.floor(n.startTick / perMeasure);
      const list = byBar.get(bar);
      if (list) list.push(n);
      else byBar.set(bar, [n]);
    }
    return byBar;
  }, [layout, perMeasure]);

  return (
    <div ref={frameRef} className={styles.frame} role="img" aria-label={t('The whole music score')}>
      {Array.from({ length: rows }, (_, row) => {
        const firstBar = row * barsPerRow;
        const barsHere = Math.min(barsPerRow, barCount - firstBar);
        const rowWidth = innerWidth * (barsHere / barsPerRow);
        const barWidth = innerWidth / barsPerRow;
        const xOf = (tick: number): number => ROW_PAD + ((tick - firstBar * perMeasure) / perMeasure) * barWidth + 14;
        return (
          <svg key={row} width={width} height={ROW_HEIGHT} viewBox={`0 0 ${width} ${ROW_HEIGHT}`} style={{ display: 'block' }}>
            {([['treble', TREBLE_BOTTOM_Y], ['bass', BASS_BOTTOM_Y]] as const).map(([staff, bottomY]) => (
              <g key={staff}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <line key={i} className={styles.line} x1={ROW_PAD} x2={ROW_PAD + rowWidth} y1={bottomY - i * 2 * SPACE} y2={bottomY - i * 2 * SPACE} />
                ))}
                {row === 0 && (
                  <text className={styles.clef} x={4} y={bottomY - 12}>
                    {staff === 'treble' ? t('R') : t('L')}
                  </text>
                )}
              </g>
            ))}
            {Array.from({ length: barsHere + 1 }, (_, i) => {
              const x = ROW_PAD + i * barWidth;
              return (
                <g key={i}>
                  <line className={styles.bar} x1={x} x2={x} y1={TREBLE_BOTTOM_Y - 8 * SPACE} y2={BASS_BOTTOM_Y} />
                  {i < barsHere && (
                    <text className={styles.barNumber} x={x + 4} y={TREBLE_BOTTOM_Y - 8 * SPACE - 6}>
                      {firstBar + i + 1}
                    </text>
                  )}
                </g>
              );
            })}
            {Array.from({ length: barsHere }, (_, i) => notesByBar.get(firstBar + i) ?? []).flat().map((note) => {
              const y = yOf(note);
              const x = xOf(note.startTick) + (note.isShifted ? HEAD_RX * 2 - 1 : 0);
              const stemUp = note.step < bottomOf(note.staff).step + 4;
              const stemX = stemUp ? x + HEAD_RX - 0.5 : x - HEAD_RX + 0.5;
              return (
                <g key={note.id}>
                  {ledgerYs(note).map((ly) => (
                    <line key={ly} className={styles.line} x1={x - HEAD_RX - 4} x2={x + HEAD_RX + 4} y1={ly} y2={ly} />
                  ))}
                  {note.accidental && (
                    <text className={styles.accidental} x={x - HEAD_RX - 13} y={y + 5}>
                      {note.accidental === 'sharp' ? '♯' : '♭'}
                    </text>
                  )}
                  <ellipse
                    className={`${styles.note} ${note.isHollow ? styles.hollow : ''}`}
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
        );
      })}
    </div>
  );
}
