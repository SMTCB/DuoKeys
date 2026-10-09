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
//
// FR-STU-020 — with `glow`, the keys that fit the chord under the line light up for
// making up your own part: chord notes filled with a dot, other notes that fit ringed.

'use client';

import { useEffect, useRef } from 'react';
import type { MasterClock } from '../../core/time/masterClock';
import type { ChordMarker, ContentNote } from '../../core/content/types';
import type { MatcherState } from '../../core/match/types';
import { harmonyAt, type HarmonyWindow } from '../../core/content/freePlaySong';
import { asTicks } from '../../core/time/types';
import { pitchToX, type KeyboardRange } from './pitchToX';
import { fitKeyboardRange } from './fitRange';
import { useNoteName } from '../i18n/useT';
import styles from './FallingNotesCanvas.module.css';

export interface FallingNotesCanvasProps {
  clock: MasterClock;
  notes: readonly ContentNote[];
  keyboardRange: KeyboardRange;
  /** The matcher's progress: groups before `groupIndex` are done, `pending` pitches in the current one are still wanted. */
  matcherState?: MatcherState | undefined;
  /** Any octave of a wanted note counts, so the keybed lights every key of that letter. */
  anyOctave?: boolean;
  /** Keys physically down, shown on the keybed. */
  pressedPitches?: readonly number[];
  /** Chord-screen staging: upcoming chords look pale and dashed, and a played chord stays green at the line until the next one lands. */
  stageChords?: boolean;
  /** Seconds of lead-in shown above the hit line (default: whatever fits the canvas). */
  lookAheadSeconds?: number;
  /** Fall speed in canvas pixels per second. */
  pixelsPerSecond?: number;
  /** FR-STU-013 lead-sheet mode — chord symbols drawn as falling text, reusing this same renderer. */
  chordMarkers?: readonly ChordMarker[];
  /** FR-STU-020 — light the keys between `low` and `high` that fit the chord now sounding. */
  glow?: FitGlow | undefined;
  /** The tag drawn on a bar for each hand (default L and R); the Portuguese screens say E and D. */
  handLabels?: { L: string; R: string } | undefined;
}

export interface FitGlow {
  windows: readonly HarmonyWindow[];
  low: number;
  high: number;
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
  anyOctave = false,
  pressedPitches,
  stageChords = false,
  lookAheadSeconds,
  pixelsPerSecond = DEFAULT_PIXELS_PER_SECOND,
  chordMarkers,
  glow,
  handLabels,
}: FallingNotesCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // FR-SYS-009 — letters in English, solfège in Portuguese; read at draw time so a language change needs no remount.
  const nameOf = useNoteName();
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  const matcherRef = useRef<MatcherState | undefined>(matcherState);
  matcherRef.current = matcherState;
  const pressedRef = useRef<readonly number[]>([]);
  pressedRef.current = pressedPitches ?? [];

  // Sorted by tick once per notes change — the frame loop only walks the sorted array.
  const sortedNotes = useRef<ContentNote[]>([]);
  const groupOrder = useRef<Map<string, number>>(new Map());
  const groupStartTick = useRef<number[]>([]);
  const lastDoneGroups = useRef(0);
  const doneAtMs = useRef(0);
  const range = useRef<KeyboardRange>(keyboardRange);

  useEffect(() => {
    sortedNotes.current = [...notes].sort((a, b) => (a.startTick as number) - (b.startTick as number));
    const order = new Map<string, number>();
    for (const n of notes) if (!order.has(n.groupId)) order.set(n.groupId, order.size);
    groupOrder.current = order;
    const starts: number[] = [];
    for (const n of sortedNotes.current) {
      const g = order.get(n.groupId) ?? 0;
      if (starts[g] === undefined) starts[g] = n.startTick as number;
    }
    groupStartTick.current = starts;
    range.current = fitKeyboardRange(
      [...notes.map((n) => n.pitch as number), ...(glow ? [glow.low, glow.high] : [])],
      keyboardRange,
    );
  }, [notes, keyboardRange, glow]);

  const glowRef = useRef<FitGlow | undefined>(glow);
  glowRef.current = glow;
  const handLabelsRef = useRef(handLabels);
  handLabelsRef.current = handLabels;

  const markersRef = useRef<readonly ChordMarker[]>([]);
  markersRef.current = chordMarkers ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number;

    // US-3.21 — colours come from the design tokens on the page, read once per mount.
    // US-3.23 / ADR-012 — a practice surface reads only the --play-* note colours
    // and ink, never the decorative Pop palette, so the bars stay legible (NFR-002).
    const css = getComputedStyle(canvas);
    const token = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
    const roleColour = token('--play-note', '#3d5a7c');
    const roleDeepColour = token('--play-note-deep', '#2a415c');
    const inkColour = token('--app-ink', '#24262b');
    const lineColour = inkColour;
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

      // FR-STU-020 — the lanes of the keys that fit now are tinted all the way up, so the eye finds them before the keybed.
      const fit = glowRef.current;
      const nowWindow = fit ? harmonyAt(fit.windows, clock.audioToTicks(clock.nowAudio()) as number) : undefined;
      // One light for every key that fits: chord notes and the safe extras look the same, so "any lit key" is the whole rule.
      const fitting = fit && nowWindow ? fitKeys(nowWindow, fit.low, fit.high) : undefined;
      const glowKeys = fitting ? new Map([...fitting.keys()].map((p) => [p, true] as const)) : undefined;
      if (glowKeys) {
        ctx.fillStyle = roleColour;
        for (const p of glowKeys.keys()) {
          const k = pitchToX(p as never, fitted);
          ctx.globalAlpha = 0.14;
          ctx.fillRect(k.x * unit, 0, k.widthUnits * unit, HIT_LINE_Y);
        }
        ctx.globalAlpha = 1;
      }

      // Hit line
      ctx.strokeStyle = lineColour;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, HIT_LINE_Y);
      ctx.lineTo(CANVAS_WIDTH, HIT_LINE_Y);
      ctx.stroke();

      // The chord just played stays green at the line for a moment, then clears (and the next chord falls in).
      if (doneGroups !== lastDoneGroups.current) {
        lastDoneGroups.current = doneGroups;
        doneAtMs.current = performance.now();
      }
      const isRecentlyDone = performance.now() - doneAtMs.current < PLAYED_STAY_MS;
      const nextStart = groupStartTick.current[doneGroups];
      const isNextArrived = nextStart === undefined || (clock.ticksToAudio(asTicks(nextStart)) as number) - nowAudio <= 0.01;
      const pinnedGroup = stageChords && progress !== undefined && isRecentlyDone && !isNextArrived ? doneGroups - 1 : -1;

      for (const note of sortedNotes.current) {
        const atSeconds = clock.ticksToAudio(note.startTick) as number;
        const secondsUntilHit = atSeconds - nowAudio;
        if (secondsUntilHit > lookAhead) break; // sorted, so nothing further can be in-window
        const endSeconds = clock.ticksToAudio(
          asTicks((note.startTick as number) + (note.durationTicks as number)),
        ) as number;
        const groupNumber = groupOrder.current.get(note.groupId) ?? 0;
        const isPinned = groupNumber === pinnedGroup;
        if (!isPinned && endSeconds - nowAudio < -0.5) continue; // fully past the line
        // A chord that has been played clears away once it crosses the line, so only what is still to play stays on screen.
        if (!isPinned && progress !== undefined && groupNumber < doneGroups && secondsUntilHit < 0.02) continue;

        const { x, isWhite, widthUnits } = pitchToX(note.pitch, fitted);
        const pxX = x * unit;
        const pxWidth = widthUnits * unit - 2;
        const pxY = isPinned ? HIT_LINE_Y : HIT_LINE_Y - secondsUntilHit * pixelsPerSecond;
        const pxHeight = Math.max(10, (endSeconds - atSeconds) * pixelsPerSecond);

        const isPending = progress !== undefined && groupNumber === progress.groupIndex;
        const isDone = progress !== undefined && (groupNumber < doneGroups || (isPending && !wanted.has(note.pitch as number) && progress.pending.length > 0));

        const isFuture = stageChords && progress !== undefined && groupNumber > progress.groupIndex;
        ctx.globalAlpha = isFuture ? 0.4 : 1;
        // Left-hand bars are the dark shade and right-hand bars the light one, each tagged L or R so colour is never the only cue (NFR-008).
        ctx.fillStyle = isDone ? doneColour : note.hand === 'L' ? roleDeepColour : note.hand === 'R' ? roleColour : isWhite ? roleColour : roleDeepColour;
        ctx.beginPath();
        ctx.roundRect(pxX + 1, pxY - pxHeight, pxWidth, pxHeight, 6);
        ctx.fill();
        // The chord being waited on gets an outline, and a played note a tick, so colour is never the only cue (NFR-008).
        if (isFuture) {
          // Upcoming notes are pale and dashed, not only a different colour (NFR-008).
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = roleDeepColour;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
        }
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
        if (note.hand !== undefined && !isDone && pxWidth >= 18 && pxHeight >= 48) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.min(13, pxWidth * 0.4)}px ${displayFont}`;
          ctx.textAlign = 'center';
          ctx.fillText(handLabelsRef.current?.[note.hand] ?? note.hand, pxX + 1 + pxWidth / 2, pxY - pxHeight + 16);
        }
        // The note's letter sits at the bottom of the bar, the end that reaches the line first.
        if (pxWidth >= 22 && pxHeight >= 24) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.min(16, pxWidth * 0.45)}px ${displayFont}`;
          ctx.textAlign = 'center';
          ctx.fillText(nameRef.current(note.pitch as number), pxX + 1 + pxWidth / 2, pxY - 7);
        }
        ctx.globalAlpha = 1;
      }

      // Chord symbols ride the stream, centred over the lanes.
      ctx.font = `800 24px ${displayFont}`;
      ctx.textAlign = 'left';
      for (const marker of markersRef.current) {
        const secondsUntilHit = (clock.ticksToAudio(marker.atTick) as number) - nowAudio;
        if (secondsUntilHit > lookAhead || secondsUntilHit < -0.12) continue;
        const pxY = HIT_LINE_Y - secondsUntilHit * pixelsPerSecond;
        // A label tab on the left edge, level with where that chord's notes arrive.
        const width = ctx.measureText(marker.symbol).width + 20;
        ctx.fillStyle = inkColour;
        ctx.beginPath();
        ctx.roundRect(8, pxY - 34, width, 32, 8);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(marker.symbol, 18, pxY - 10);
      }

      const doneNow = pitchesDone(sortedNotes.current, groupOrder.current, progress);
      // The chord just played keeps its keys green on the keybed for as long as its bars stay at the line.
      const doneKeys = new Set<number>(doneNow);
      if (pinnedGroup >= 0) for (const n of sortedNotes.current) if (groupOrder.current.get(n.groupId) === pinnedGroup) doneKeys.add(n.pitch as number);
      const lit = (pitches: Iterable<number>): Set<number> => {
        const out = new Set<number>(pitches);
        if (!anyOctave) return out;
        const classes = new Set([...out].map((p) => p % 12));
        for (let p = fitted.low as number; p <= (fitted.high as number); p++) if (classes.has(p % 12)) out.add(p);
        return out;
      };
      drawKeybed(ctx, fitted, unit, wanted, lit(wanted), doneKeys, new Set(pressedRef.current), {
        wantedColour: roleColour,
        doneColour,
        inkColour,
      }, nameRef.current, glowKeys);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [clock, lookAheadSeconds, pixelsPerSecond, anyOctave, stageChords]);

  return <canvas ref={canvasRef} className={styles.canvas} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />;
}

/** How long a played chord stays green at the line; matches the hold dwell in sessionStore. */
const PLAYED_STAY_MS = 600;

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

/** Each key in range that fits the window, true for the chord's own notes. */
function fitKeys(window: HarmonyWindow, low: number, high: number): Map<number, boolean> {
  const keys = new Map<number, boolean>();
  for (let p = low; p <= high; p++) {
    const pc = p % 12;
    if (window.fitPitchClasses.includes(pc)) keys.set(p, window.chordPitchClasses.includes(pc));
  }
  return keys;
}

function drawKeybed(
  ctx: CanvasRenderingContext2D,
  range: KeyboardRange,
  unit: number,
  exactWanted: ReadonlySet<number>,
  wanted: ReadonlySet<number>,
  played: ReadonlySet<number>,
  pressed: ReadonlySet<number>,
  colours: { wantedColour: string; doneColour: string; inkColour: string },
  noteName: (pitch: number, withOctave?: boolean) => string,
  glow?: ReadonlyMap<number, boolean>,
): void {
  const top = CANVAS_HEIGHT - KEYBED_HEIGHT;
  for (const pass of ['white', 'black'] as const) {
    for (let p = range.low as number; p <= (range.high as number); p++) {
      const k = pitchToX(p as never, range);
      if (k.isWhite !== (pass === 'white')) continue;
      const w = k.widthUnits * unit;
      const h = k.isWhite ? KEYBED_HEIGHT : KEYBED_HEIGHT * 0.62;
      const isWanted = wanted.has(p);
      const isHeld = pressed.has(p);
      const isDone = played.has(p) || (isHeld && isWanted);
      // The exact key a bar is aimed at is solid; other octaves of the same letter are a lighter hint.
      const isExact = exactWanted.has(p);
      ctx.fillStyle = isDone
        ? colours.doneColour
        : isHeld
          ? '#b9bcc4'
          : isWanted
            ? colours.wantedColour
            : k.isWhite
              ? '#ffffff'
              : '#2b2d33';
      const isHint = isWanted && !isExact && !isDone && !isHeld;
      ctx.globalAlpha = isHint ? 0.4 : 1;
      ctx.fillRect(k.x * unit, top, w, h);
      ctx.strokeStyle = colours.inkColour;
      ctx.lineWidth = isExact ? 3 : 1;
      ctx.strokeRect(k.x * unit, top, w, h);
      ctx.globalAlpha = 1;
      const glowing = glow?.get(p);
      if (glowing !== undefined && !isWanted && !isDone && !isHeld) {
        // A chord note is tinted and dotted, another note that fits is ringed: shape, not only colour (NFR-008).
        const cx = k.x * unit + w / 2;
        const cy = top + h - (k.isWhite ? 26 : 12);
        const radius = Math.max(3, Math.min(7, w * 0.28));
        if (glowing) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = colours.wantedColour;
          ctx.fillRect(k.x * unit, top, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        if (glowing) {
          ctx.fillStyle = k.isWhite ? colours.wantedColour : '#ffffff';
          ctx.fill();
        } else {
          ctx.strokeStyle = k.isWhite ? colours.wantedColour : '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      if ((isWanted || isDone) && w >= 18) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${Math.min(15, w * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(noteName(p, false), k.x * unit + w / 2, top + h - 6);
      } else if (k.isWhite && w >= 16) {
        // Every white key is named (letter only; each C also carries its octave number), so a
        // child can find the key by reading it, and the adult has a landmark to count from.
        ctx.fillStyle = colours.inkColour;
        ctx.globalAlpha = p % 12 === 0 ? 1 : 0.55;
        ctx.font = `${p % 12 === 0 ? 700 : 600} ${Math.min(13, w * 0.5)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p % 12 === 0 ? noteName(p) : noteName(p, false), k.x * unit + w / 2, top + h - 6);
        ctx.globalAlpha = 1;
      }
    }
  }
}
