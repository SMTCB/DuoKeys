// TA-APP-003 `/explorer/play/[id]` — falling-notes practice, wait mode
// (US-1.10/1.11/1.13). Client component: it owns the MIDI device picker, the
// live falling-notes canvas, and the post-attempt star display. All matching
// and grading happen in core/ via the sessionStore wiring; this component
// only reads state and dispatches the three session actions.

'use client';

import { useEffect, useMemo, useState } from 'react';
import controls from '../../../../ui/shared/Controls.module.css';
import { Segmented } from '../../../../ui/shared/Segmented';
import { useT } from '../../../../ui/i18n/useT';
import { ScrollingScore } from '../../../../ui/score/ScrollingScore';
import Link from 'next/link';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useSessionStore, type PracticeMode } from '../../../../runtime/stores/sessionStore';
import { useSessionArcStore } from '../../../../runtime/stores/sessionArcStore';
import { getAdapters } from '../../../../runtime/bootstrap';
import { FallingNotesCanvas } from '../../../../ui/falling/FallingNotesCanvas';
import { PageShell } from '../../../../ui/shared/PageShell';
import { StatusNote } from '../../../../ui/shared/StatusNote';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import { MidiChooser } from '../../../../ui/shared/MidiChooser';
import stage from '../../../../ui/shared/Stage.module.css';
import { ResultCard } from '../../../../ui/shared/ResultCard';
import { usePieceTitle } from '../../../../ui/shared/usePieceTitle';
import type { Arrangement } from '../../../../core/content/types';

export default function ExplorerPlayPage() {
  const router = useRouter();
  const t = useT();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get('section') ?? undefined;
  const profile = useSessionStore((s) => s.profile);
  const midiInputs = useSessionStore((s) => s.midiInputs);
  const midiConnectionState = useSessionStore((s) => s.midiConnectionState);
  const clock = useSessionStore((s) => s.clock);
  const activeNotes = useSessionStore((s) => s.activeNotes);
  const matcherState = useSessionStore((s) => s.matcherState);
  const attemptStatus = useSessionStore((s) => s.attemptStatus);
  const grade = useSessionStore((s) => s.grade);
  const refreshMidiInputs = useSessionStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useSessionStore((s) => s.selectMidiInput);
  const startArrangement = useSessionStore((s) => s.startArrangement);
  const endSession = useSessionStore((s) => s.endSession);

  // The session store outlives the page: without this, arriving from another piece shows that
  // piece's notes (and what was played in them) under this piece's title.
  useEffect(() => {
    endSession();
    return endSession;
  }, [endSession]);
  const arcActive = useSessionArcStore((s) => s.active);
  const advanceArc = useSessionArcStore((s) => s.advance);

  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [view, setView] = useState<'falling' | 'score'>('falling');
  const [loadError, setLoadError] = useState<string | undefined>();
  const [mode, setMode] = useState<PracticeMode>('wait');

  useEffect(() => {
    void refreshMidiInputs();
  }, [refreshMidiInputs]);

  useEffect(() => {
    let cancelled = false;
    getAdapters()
      .content.arrangement(params.id)
      .then((a) => {
        if (!cancelled) setArrangement(a);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const pieceTitle = usePieceTitle(arrangement?.pieceId);
  const track = arrangement?.tracks[0];
  // Sequential distinct groupIds, in the same order WaitMatcher.expect() saw
  // them (notes are already tick-sorted) — this is what lets a numeric
  // matcherState.groupIndex be turned back into the groupId to highlight.
  // Uses activeNotes (the section-scoped list once playing) so it stays in
  // sync with what the matcher actually expects, not the whole track.
  const notesForDisplay = useMemo(() => activeNotes ?? track?.notes ?? [], [activeNotes, track]);

  async function handleSelectMidi(inputId: string): Promise<void> {
    if (!arrangement || !track) return;
    await selectMidiInput(inputId);
    await startArrangement(arrangement, track.id, crypto.randomUUID(), new Date().toISOString(), sectionId, mode);
  }

  if (loadError) return <PageShell><StatusNote tone="problem">{t('Could not load this piece: {error}', { error: loadError })}</StatusNote></PageShell>;
  if (!arrangement || !track) return <PageShell><StatusNote /></PageShell>;

  return (
    <PageShell>
      <Link href={`/explorer/${arrangement.id}`} className={stage.back}>
        {t('← Quest map')}
      </Link>
      <h1>{pieceTitle !== undefined ? t(pieceTitle) : arrangement.id}</h1>

      {attemptStatus === 'idle' && (
        <Card>
          <div className={`${stage.stage} ${stage.left}`}>
            <p className={stage.title}>{t('How should we play?')}</p>
            <div className={stage.modes}>
              <label className={stage.mode}>
                <input
                  type="radio"
                  name="mode"
                  value="wait"
                  checked={mode === 'wait'}
                  onChange={() => setMode('wait')}
                />
                <span className={stage.modeName}>{t('Wait for me')}</span>
                <span className={stage.modeHint}>{t('It waits for your key')}</span>
              </label>
              <label className={stage.mode}>
                <input
                  type="radio"
                  name="mode"
                  value="timed"
                  checked={mode === 'timed'}
                  onChange={() => setMode('timed')}
                />
                <span className={stage.modeName}>{t('Keep the beat')}</span>
                <span className={stage.modeHint}>{t('Play along in time')}</span>
              </label>
            </div>
            <MidiChooser
              inputs={midiInputs}
              connectionState={midiConnectionState}
              onSelect={(id) => void handleSelectMidi(id)}
            />
          </div>
        </Card>
      )}

      {attemptStatus === 'playing' && (
        <div className={controls.bar}>
          <Segmented
            name="view"
            legend={t('Show')}
            options={[
              { value: 'falling' as const, label: t('Falling notes') },
              { value: 'score' as const, label: t('Music score') },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      )}

      {attemptStatus === 'playing' && view === 'score' && (
        <ScrollingScore arrangement={arrangement} trackId={track.id} groupIndex={matcherState?.groupIndex ?? 0} isFinished={false} notes={activeNotes ?? undefined} />
      )}

      {attemptStatus === 'playing' && clock && view === 'falling' && (
        <FallingNotesCanvas
          clock={clock}
          notes={notesForDisplay}
          keyboardRange={profile.keyboardRange}
          matcherState={matcherState}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <ResultCard
          stars={grade.stars}
          title={grade.stars >= 3 ? t('Amazing playing!') : grade.stars === 2 ? t('Great playing!') : t('You did it!')}
          hasBurst
          actions={
            arcActive ? (
              <Button
                accent="amber"
                onClick={() => {
                  advanceArc();
                  router.push(`/explorer/${arrangement.id}/session`);
                }}
              >
                {t('Continue your session')}
              </Button>
            ) : undefined
          }
        />
      )}
    </PageShell>
  );
}
