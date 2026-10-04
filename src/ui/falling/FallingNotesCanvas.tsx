// TA-REN-001 — falling notes, Canvas 2D. Explorer wait mode (US-1.10).
//
// Single <canvas>, requestAnimationFrame, no per-note DOM. Position comes
// from MasterClock every frame, never an animation counter (ADR-006 — the audio
// clock is master; a counter drifts against it). Positions are derived from
// ticks each frame (not cached as audio times) because wait mode holds the
// clock on the pending chord (TA-MAT-002) and a cached time would go stale.
//
// The lanes fit the notes being played, not the whole 88 keys: a progression
// that lives in two octaves fills the screen instead of hugging one edge.
// Below the hit line a small keybed shows which keys are wanted now and which
// were just played right, so a correct note is visibly recognised.

'use client';

import { useEffect, useRef } from 'react';
import type { MasterClock } from '../../core/time/masterClock';
import type { ChordMarker, ContentNote } from '../../core/content/types';
import type { MatcherState } from '../../core/match/types';
import { asTicks } from '../../core/time/types';
import { pitchToX, type KeyboardRange } from './pitchToX';
import { fitKeyboardRange } from './fitRange';
import { noteName } from './noteName';
import styles from './FallingNotesCanvas.module.css';

export interface FallingNotesCanvasProps {
  clock: MasterClock;
  notes: readonly ContentNote[];
  keyboardRange: KeyboardRange;
  /** The matcher's progress: groups before `groupIndex` are done, `pending` pitches in the current one are still wanted. */
  matcherState?: MatcherState | undefined;
  /** Seconds of lead-in shown above the hit line (default: whatever fits the canvas). */
  lookAheadSeconds?: number;
  /** Fall speed in canvas pixels per second. */
  pixelsPerSecond?: number;
  /** FR-STU-013 lead-sheet mode — chord symbols drawn as falling text, reusing this same renderer. */
  chordMarkers?: readonly ChordMarker[];
}

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const KEYBED_HEIGHT = 72;
const HIT_LINE_Y = CANVAS_HEIGHT - KEYBED_HEIGHT - 8;
export const DEFAULT_PIXELS_PER_SECOND = 140;

export function FallingNotesCanvas({
  clock,
  notes,
  keyboardRange,
  matcherState,
  lookAheadSeconds,
  pixelsPerSecond = DEFAULT_PIXELS_PER_SECOND,
  chordMarkers,
}: FallingNotesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const matcherRef = useRef<MatcherState | undefined>(matcherState);
  matcherRef.current = matcherState;

  // Sorted by tick once per notes change — the frame loop only walks the sorted array.
  const sortedNotes = useRef<ContentNote[]>([]);
  const groupOrder = useRef<Map<string, number>>(new Map());
  const range = useRef<KeyboardRange>(keyboardRange);

  useEffect(() => {
    sortedNotes.current = [...notes].sort((a, b) => (a.startTick as number) - (b.startTick as number));
    const order = new Map<string, number>();
    for (const n of notes) if (!order.has(n.groupId)) order.set(n.groupId, order.size);
    groupOrder.current = order;
    range.current = fitKeyboardRange(
      notes.map((n) => n.pitch as number),
      keyboardRange,
    );
  }, [notes, keyboardRange]);

  const markersRef = useRef<readonly ChordMarker[]>([]);
  markersRef.current = chordMarkers ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    // US-3.21 — colours come from the design tokens on the page (the role
    // colour: amber in Explorer, indigo in Studio), read once per mount.
    const css = getComputedStyle(canvas);
    const token = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
    const roleColour = token('--role', '#3d5a7c');
    const roleDeepColour = token('--role-deep', '#2a415c');
    const inkColour = token('--app-ink', '#24262b');
    const lineColour = token('--coral', '#dd6e4b');
    const displayFont = token('--display', 'sans-serif');
    const doneColour = '#2f9e5c';

    const lookAhead = lookAheadSeconds ?? HIT_LINE_Y / pixelsPerSecond;

    const draw = (): void => {
      rafId = requestAnimationFrame(draw);

      const nowAudio = clock.nowAudio() as number;
      const fitted = range.current;
      const unit = whiteKeyPx(fitted);
      const progress = matcherRef.current;
      const doneGroups = progress ? progress.groupIndex : 0;
      const wanted = new Set<number>((progress?.pending ?? []).map((p) => p as number));

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Faint lane guides on the white keys, so a falling bar reads as "this key".
      ctx.fillStyle = 'rgba(0,0,0,0.035)';
      for (let p = fitted.low as number; p <= (fitted.high as number); p++) {
        const k = pitchToX(p as never, fitted);
        if (k.isWhite && Math.round(k.x) % 2 === 0) ctx.fillRect(k.x * unit, 0, unit, HIT_LINE_Y);
      }

      // Hit line
      ctx.strokeStyle = lineColour;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(CANVAS_WIDTH, HIT_LINE_Y);
      ctx.stroke();

      for (const note of sortedNotes.current) {
        const atSeconds = clock.ticksToAudio(note.startTick) as number;
        const secondsUntilHit = atSeconds - nowAudio;
        if (secondsUntilHit > lookAhead) break; // sorted, so nothing further can be in-window
        const endSeconds = clock.ticksToAudio(
          asTicks((note.startTick as number) + (note.durationTicks as number)),
        ) as number;
        if (endSeconds - nowAudio < -0.5) continue; // fully past the line

        const { x, isWhite, widthUnits } = pitchToX(note.pitch, fitted);
        const pxX = x * unit;
        const pxWidth = widthUnits * unit - 2;
        const pxY = HIT_LINE_Y - secondsUntilHit * pixelsPerSecond;
        const pxHeight = Math.max(10, (endSeconds - atSeconds) * pixelsPerSecond);

        const groupNumber = groupOrder.current.get(note.groupId) ?? 0;
        const isPending = progress !== undefined && groupNumber === progress.groupIndex;
        const isDone = progress !== undefined && (groupNumber < doneGroups || (isPending && !wanted.has(note.pitch as number) && progress.pending.length > 0));

        ctx.fillStyle = isDone ? doneColour : isWhite ? roleColour : roleDeepColour;
        ctx.beginPath();
        ctx.roundRect(pxX + 1, pxY - pxHeight, pxWidth, pxHeight, 6);
        ctx.fill();
        // The chord being waited on gets an outline, and a played note a tick, so colour is never the only cue (NFR-008).
        if (isPending && !isDone) {
          ctx.strokeStyle = inkColour;
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        if (isDone && pxWidth >= 14) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.min(18, pxWidth - 4)}px ${displayFont}`;
          ctx.textAlign = 'center';
          ctx.fillText('✓', pxX + 1 + pxWidth / 2, pxY - pxHeight + 20);
        }
        // The note's letter sits at the bottom of the bar, the end that reaches the line first.
        if (pxWidth >= 22 && pxHeight >= 24) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.min(16, pxWidth * 0.45)}px ${displayFont}`;
          ctx.textAlign = 'center';
          ctx.fillText(noteName(note.pitch as number), pxX + 1 + pxWidth / 2, pxY - 7);
        }
      }

      // Chord symbols ride the stream, centred over the lanes.
      ctx.font = `700 22px ${displayFont}`;
      ctx.fillStyle = inkColour;
      ctx.textAlign = 'center';
      for (const marker of markersRef.current) {
        const secondsUntilHit = (clock.ticksToAudio(marker.atTick) as number) - nowAudio;
        if (secondsUntilHit > lookAhead || secondsUntilHit < -0.5) continue;
        const pxY = HIT_LINE_Y - secondsUntilHit * pixelsPerSecond;
        ctx.fillText(marker.symbol, CANVAS_WIDTH / 2, pxY - 12);
      }

      drawKeybed(ctx, fitted, unit, wanted, new Set(pitchesDone(sortedNotes.current, groupOrder.current, progress)), {
        wantedColour: roleColour,
        doneColour,
        inkColour,
      });
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [clock, lookAheadSeconds, pixelsPerSecond]);

  return <canvas ref={canvasRef} className={styles.canvas} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
}

function whiteKeyPx(range: KeyboardRange): number {
  const last = pitchToX(range.high, range);
  return CANVAS_WIDTH / (last.x + 1);
}

/** Pitches of the current chord already played (shown green on the keybed). */
function pitchesDone(
  notes: readonly ContentNote[],
  groupOrder: ReadonlyMap<string, number>,
  progress: MatcherState | undefined,
): number[] {
  if (!progress || progress.pending.length === 0) return [];
  const pending = new Set(progress.pending.map((p) => p as number));
  const done: number[] = [];
  for (const n of notes) {
    if (groupOrder.get(n.groupId) === progress.groupIndex && !pending.has(n.pitch as number)) done.push(n.pitch as number);
  }
  return done;
}

function drawKeybed(
  ctx: CanvasRenderingContext2D,
  range: KeyboardRange,
  unit: number,
  wanted: ReadonlySet<number>,
  done: ReadonlySet<number>,
  colours: { wantedColour: string; doneColour: string; inkColour: string },
): void {
  const top = CANVAS_HEIGHT - KEYBED_HEIGHT;
  for (const pass of ['white', 'black'] as const) {
    for (let p = range.low as number; p <= (range.high as number); p++) {
      const k = pitchToX(p as never, range);
      if (k.isWhite !== (pass === 'white')) continue;
      const w = k.widthUnits * unit;
      const h = k.isWhite ? KEYBED_HEIGHT : KEYBED_HEIGHT * 0.62;
      const isWanted = wanted.has(p);
      const isDone = done.has(p);
      ctx.fillStyle = isDone ? colours.doneColour : isWanted ? colours.wantedColour : k.isWhite ? '#ffffff' : '#2b2d33';
      ctx.fillRect(k.x * unit, top, w, h);
      ctx.strokeStyle = colours.inkColour;
      ctx.lineWidth = isWanted ? 3 : 1;
      ctx.strokeRect(k.x * unit, top, w, h);
      if ((isWanted || isDone) && w >= 18) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.min(15, w * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(noteName(p, false), k.x * unit + w / 2, top + h - 6);
      }
    }
  }
}
