// TA-REN-004, NFR-006, US-3.01/US-3.03 — real staff notation, the Studio
// counterpart to FallingNotesCanvas. opensheetmusicdisplay is never imported
// statically (it's a large library the Explorer bundle must never pay for) —
// only ever behind the dynamic import() inside the load effect.

'use client';

import { useEffect, useRef } from 'react';
import type { OpenSheetMusicDisplay } from 'opensheetmusicdisplay';
import { arrangementToMusicXml } from '../../core/content/toMusicXml';
import { chordsToMusicXml } from '../../core/content/chordScoreXml';
import type { Arrangement } from '../../core/content/types';
import type { Grade, NoteResult } from '../../core/grade/grade';
import type { AttemptStatus } from '../../runtime/stores/sessionStore';

interface NotationViewProps {
  arrangement: Arrangement;
  trackId: string;
  /** Mirrors matcherState.groupIndex — current content is single-voice with
   * one note per group (documented in toMusicXml.ts), so N cursor.next()
   * calls from the start lands the cursor on the pending note. */
  groupIndex: number;
  attemptStatus: AttemptStatus;
  grade: Grade | undefined;
  /**
   * 'melody' (default) is the single-line staff; 'chords' is a piano grand staff
   * with one chord per measure, drawn as one long line that scrolls left to right
   * so the pending chord stays in view (FR-STU-015).
   */
  layout?: 'melody' | 'chords';
}

const OUTCOME_COLOR: Partial<Record<NoteResult['outcome'], string>> = {
  correct: '#2f9e5c',
  wrong: '#c0392b',
  missed: '#8b8f86',
};

export function NotationView({ arrangement, trackId, groupIndex, attemptStatus, grade, layout = 'melody' }: NotationViewProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | undefined>(undefined);
  const groupIndexRef = useRef(groupIndex);
  groupIndexRef.current = groupIndex;

  // Keeps the pending chord about a quarter of the way in, so what is coming is always on screen.
  function followCursor(): void {
    if (layout !== 'chords') return;
    const scroller = scrollerRef.current;
    const cursorEl = osmdRef.current?.cursor.cursorElement;
    if (!scroller || !cursorEl) return;
    scroller.scrollTo({ left: Math.max(0, cursorEl.offsetLeft - scroller.clientWidth * 0.25), behavior: 'smooth' });
  }

  useEffect(() => {
    let cancelled = false;
    osmdRef.current = undefined;

    async function load(): Promise<void> {
      const container = containerRef.current;
      if (!container) return;
      const { OpenSheetMusicDisplay: OSMD } = await import('opensheetmusicdisplay');
      if (cancelled) return;
      const isChords = layout === 'chords';
      const osmd = new OSMD(container, {
        autoResize: true,
        drawTitle: false,
        ...(isChords ? { renderSingleHorizontalStaffline: true, followCursor: false } : {}),
      });
      const xml = isChords ? chordsToMusicXml(arrangement, trackId) : arrangementToMusicXml(arrangement, trackId);
      await osmd.load(xml);
      if (cancelled) return;
      osmd.render();
      osmd.cursor.show();
      for (let i = 0; i < groupIndexRef.current; i++) osmd.cursor.next();
      osmdRef.current = osmd;
      followCursor();
    }
    void load();

    return () => {
      cancelled = true;
      osmdRef.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement.id, trackId, layout]);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd) return;
    osmd.cursor.reset();
    for (let i = 0; i < groupIndex; i++) osmd.cursor.next();
    followCursor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex]);

  useEffect(() => {
    const osmd = osmdRef.current;
    if (!osmd || attemptStatus !== 'complete' || !grade) return;
    const track = arrangement.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const outcomeByExpectedId = new Map<string, NoteResult['outcome']>(
      grade.perNote
        .filter((n): n is NoteResult & { expectedId: string } => n.expectedId !== undefined)
        .map((n) => [n.expectedId, n.outcome]),
    );

    osmd.cursor.reset();
    for (const note of track.notes) {
      const color = OUTCOME_COLOR[outcomeByExpectedId.get(note.id) as NoteResult['outcome']];
      if (color) {
        for (const gNote of osmd.cursor.GNotesUnderCursor()) {
          gNote.setColor(color, { applyToNoteheads: true });
        }
      }
      osmd.cursor.next();
    }
    osmd.cursor.hide();
  }, [attemptStatus, grade, arrangement, trackId]);

  return (
    <div ref={scrollerRef} style={layout === 'chords' ? { overflowX: 'auto' } : undefined}>
      <div ref={containerRef} />
    </div>
  );
}
