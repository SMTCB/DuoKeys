// TA-REN-001 — falling notes, Canvas 2D. Explorer wait mode (US-1.10).
//
// Single <canvas>, requestAnimationFrame, no per-note DOM. Position comes
// from MasterClock.nowAudio() every frame, never an animation counter
// (ADR-006 — the audio clock is master; a counter drifts against it).
// Off-screen notes are culled by a windowed index into the sorted note array
// rather than iterating every note every frame.

'use client';

import { useEffect, useRef } from 'react';
import type { MasterClock } from '../../core/time/masterClock';
import type { ChordMarker, ContentNote } from '../../core/content/types';
import { asTicks } from '../../core/time/types';
import { pitchToX, type KeyboardRange } from './pitchToX';

export interface FallingNotesCanvasProps {
  clock: MasterClock;
  notes: readonly ContentNote[];
  keyboardRange: KeyboardRange;
  /** Which groupId the WaitMatcher is currently frozen on — drawn highlighted at the hit line. */
  pendingGroupId: string | undefined;
  /** Seconds of lead-in shown above the hit line. */
  lookAheadSeconds?: number;
  /** FR-STU-013 lead-sheet mode — chord symbols drawn as falling text, reusing this same renderer. */
  chordMarkers?: readonly ChordMarker[];
}

const WHITE_KEY_PX = 32;
const HIT_LINE_Y_FROM_BOTTOM = 96;
const PIXELS_PER_SECOND = 140;

export function FallingNotesCanvas({
  clock,
  notes,
  keyboardRange,
  pendingGroupId,
  lookAheadSeconds = 4,
  chordMarkers,
}: FallingNotesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Sorted once per notes/clock change, not every frame — the render loop
  // only needs to find its windowed slice into an already-sorted array.
  const sortedRef = useRef<{ note: ContentNote; atSeconds: number }[]>([]);
  const sortedMarkersRef = useRef<{ marker: ChordMarker; atSeconds: number }[]>([]);

  useEffect(() => {
    sortedRef.current = notes
      .map((note) => ({ note, atSeconds: clock.ticksToAudio(note.startTick) as number }))
      .sort((a, b) => a.atSeconds - b.atSeconds);
  }, [notes, clock]);

  useEffect(() => {
    sortedMarkersRef.current = (chordMarkers ?? [])
      .map((marker) => ({ marker, atSeconds: clock.ticksToAudio(marker.atTick) as number }))
      .sort((a, b) => a.atSeconds - b.atSeconds);
  }, [chordMarkers, clock]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    const draw = (): void => {
      rafId = requestAnimationFrame(draw);

      const { width, height } = canvas;
      const nowAudio = clock.nowAudio() as number;
      const hitLineY = height - HIT_LINE_Y_FROM_BOTTOM;

      ctx.clearRect(0, 0, width, height);

      // Hit line
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, hitLineY);
      ctx.lineTo(width, hitLineY);
      ctx.stroke();

      const windowStart = nowAudio - 1; // a little past the hit line, for notes still resolving
      const windowEnd = nowAudio + lookAheadSeconds;

      for (const { note, atSeconds } of sortedRef.current) {
        if (atSeconds < windowStart) continue;
        if (atSeconds > windowEnd) break; // sorted, so nothing further can be in-window

        const { x, isWhite, widthUnits } = pitchToX(note.pitch, keyboardRange);
        const pxX = x * WHITE_KEY_PX;
        const pxWidth = widthUnits * WHITE_KEY_PX - 2;
        const secondsUntilHit = atSeconds - nowAudio;
        const pxY = hitLineY - secondsUntilHit * PIXELS_PER_SECOND;
        const endSeconds = clock.ticksToAudio(
          asTicks((note.startTick as number) + (note.durationTicks as number)),
        ) as number;
        const durationSeconds = Math.max(0, endSeconds - atSeconds);
        const pxHeight = Math.max(8, durationSeconds * PIXELS_PER_SECOND);

        const isPending = note.groupId === pendingGroupId;
        ctx.fillStyle = isWhite ? (isPending ? '#4a90d9' : '#2d6cb3') : isPending ? '#d9a24a' : '#b37c2d';
        ctx.fillRect(pxX + 1, pxY - pxHeight, pxWidth, pxHeight);
      }

      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#444';
      ctx.textAlign = 'center';
      for (const { marker, atSeconds } of sortedMarkersRef.current) {
        if (atSeconds < windowStart) continue;
        if (atSeconds > windowEnd) break;
        const secondsUntilHit = atSeconds - nowAudio;
        const pxY = hitLineY - secondsUntilHit * PIXELS_PER_SECOND;
        ctx.fillText(marker.symbol, width / 2, pxY - 12);
      }
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [clock, keyboardRange, pendingGroupId, lookAheadSeconds]);

  return <canvas ref={canvasRef} width={960} height={540} />;
}
