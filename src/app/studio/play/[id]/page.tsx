// TA-APP-003 `/studio/play/[id]` — US-3.01/US-3.02/US-3.03/US-3.05. Same
// MIDI-picker -> sessionStore wiring as `/explorer/play/[id]`, plus a
// falling-notes/notation view toggle and a tempo slider. No quest/section
// scoping, no session-arc integration, no "explorer floor" messaging — Studio
// grades honestly (sessionStore already gates the floor on profile.role).

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore, type AccompanimentMode, type PracticeMode } from '../../../../runtime/stores/sessionStore';
import { useGeneratedContentStore } from '../../../../runtime/stores/generatedContentStore';
import { getAdapters } from '../../../../runtime/bootstrap';
import { FallingNotesCanvas } from '../../../../ui/falling/FallingNotesCanvas';
import { NotationView } from '../../../../ui/notation/NotationView';
import { PageShell } from '../../../../ui/shared/PageShell';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import type { Arrangement, Track } from '../../../../core/content/types';
import { ticksPerMeasure } from '../../../../core/content/toMusicXml';
import { asTicks } from '../../../../core/time/types';
import { loadSongBytes, loadSongIndex } from '../../../../adapters/content/staticSongs';
import { parseSmf } from '../../../../core/midi/smf';
import { isMonophonic, smfToArrangement } from '../../../../core/content/songLibrary';
import { describeArticulation, describeEvenness, describeRushDrag } from '../../../../core/grade/grade';

type StudioView = 'falling' | 'notation';

const TEMPO_MIN = 30;
const TEMPO_MAX = 100;
const TEMPO_STEP = 5;

// FR-STU-005 — a plain-language label for a track's hand/role, since the
// child-facing icon-based labelling (Explorer) doesn't apply to Studio.
function trackLabel(track: Track): string {
  if (track.hand === 'L') return 'Left hand';
  if (track.hand === 'R') return 'Right hand';
  if (track.id === 'both') return 'Both hands';
  return track.role;
}

export default function StudioPlayPage() {
  const params = useParams<{ id: string }>();
  const getGenerated = useGeneratedContentStore((s) => s.get);
  const profile = useSessionStore((s) => s.profile);
  const midiInputs = useSessionStore((s) => s.midiInputs);
  const midiConnectionState = useSessionStore((s) => s.midiConnectionState);
  const clock = useSessionStore((s) => s.clock);
  const activeNotes = useSessionStore((s) => s.activeNotes);
  const matcherState = useSessionStore((s) => s.matcherState);
  const attemptStatus = useSessionStore((s) => s.attemptStatus);
  const grade = useSessionStore((s) => s.grade);
  const tempoScale = useSessionStore((s) => s.tempoScale);
  const loopRange = useSessionStore((s) => s.loopRange);
  const autoRampEnabled = useSessionStore((s) => s.autoRampEnabled);
  const passNumber = useSessionStore((s) => s.passNumber);
  const lastPassGrade = useSessionStore((s) => s.lastPassGrade);
  const refreshMidiInputs = useSessionStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useSessionStore((s) => s.selectMidiInput);
  const startArrangement = useSessionStore((s) => s.startArrangement);
  const setTempoScale = useSessionStore((s) => s.setTempoScale);
  const setLoopRange = useSessionStore((s) => s.setLoopRange);
  const setAutoRamp = useSessionStore((s) => s.setAutoRamp);
  const setAccompanimentMode = useSessionStore((s) => s.setAccompanimentMode);
  const stopLoop = useSessionStore((s) => s.stopLoop);

  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [mode, setMode] = useState<PracticeMode>('wait');
  const [view, setView] = useState<StudioView>('falling');
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [loopFromMeasure, setLoopFromMeasure] = useState(1);
  const [loopToMeasure, setLoopToMeasure] = useState(2);
  const [autoRampChecked, setAutoRampChecked] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | undefined>();
  const [accompaniment, setAccompaniment] = useState<AccompanimentMode>('silent');

  useEffect(() => {
    void refreshMidiInputs();
  }, [refreshMidiInputs]);

  useEffect(() => {
    // US-3.10 — a sight-reading phrase lives only in generatedContentStore
    // (never baked into content/sources/, TA-CNT-004), so check there first
    // before falling back to the normal build-time content backend.
    const generated = getGenerated(params.id);
    if (generated) {
      setArrangement(generated);
      setSelectedTrackId(generated.tracks[0]?.id);
      return;
    }
    let cancelled = false;
    // FR-STU-016 — a song from the library is a MIDI file converted on the spot.
    const load: Promise<Arrangement> = params.id.startsWith('mutopia-')
      ? Promise.all([loadSongBytes(params.id), loadSongIndex().catch(() => undefined)]).then(([bytes, index]) => {
          if (!bytes) throw new Error('that song file is missing from this copy of the library');
          const parsed = parseSmf(bytes);
          if (!parsed.ok) throw new Error(parsed.error);
          const made = smfToArrangement(parsed.file, { id: params.id, title: index?.songs.find((x) => x.id === params.id)?.title ?? params.id });
          if (!made) throw new Error('that file has no notes');
          return made;
        })
      : getAdapters().content.arrangement(params.id);
    load
      .then((a) => {
        if (!cancelled) {
          setArrangement(a);
          setSelectedTrackId(a.tracks[0]?.id);
        }
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [params.id, getGenerated]);

  const track = arrangement?.tracks.find((t) => t.id === selectedTrackId) ?? arrangement?.tracks[0];
  const notesForDisplay = useMemo(() => activeNotes ?? track?.notes ?? [], [activeNotes, track]);
  const orderedGroupIds = useMemo(() => {
    const seen: string[] = [];
    for (const note of notesForDisplay) {
      if (seen[seen.length - 1] !== note.groupId) seen.push(note.groupId);
    }
    return seen;
  }, [notesForDisplay]);
  const pendingGroupId =
    matcherState && matcherState.groupIndex < orderedGroupIds.length
      ? orderedGroupIds[matcherState.groupIndex]
      : undefined;

  // FR-STU-003 — measure range picker; ticksPerMeasure is the same helper
  // toMusicXml.ts uses to bucket notes, so loop boundaries always land on a
  // measure line.
  const perMeasure = arrangement ? ticksPerMeasure(arrangement.timeSig) : 0;
  const totalMeasures = useMemo(() => {
    if (!track || perMeasure === 0) return 1;
    const lastTick = track.notes.reduce(
      (max, n) => Math.max(max, (n.startTick as number) + (n.durationTicks as number)),
      0,
    );
    return Math.max(1, Math.ceil(lastTick / perMeasure));
  }, [track, perMeasure]);

  async function handleSelectMidi(inputId: string): Promise<void> {
    if (!arrangement || !track) return;
    setLoopRange(
      loopEnabled && loopToMeasure > loopFromMeasure
        ? {
            startTick: asTicks((loopFromMeasure - 1) * perMeasure),
            endTick: asTicks(loopToMeasure * perMeasure),
          }
        : undefined,
    );
    setAutoRamp(loopEnabled && autoRampChecked);
    setAccompanimentMode(arrangement.tracks.length > 1 ? accompaniment : 'silent');
    await selectMidiInput(inputId);
    await startArrangement(arrangement, track.id, crypto.randomUUID(), new Date().toISOString(), undefined, mode);
  }

  // FR-STU-016 — notation can only draw a single line; a full piece plays as falling notes only.
  const canShowNotation = track ? isMonophonic(track) : true;
  const shownView: StudioView = canShowNotation ? view : 'falling';

  if (loadError) return <PageShell><p>Could not load this piece: {loadError}</p></PageShell>;
  if (!arrangement || !track) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>{params.id.startsWith('mutopia-') ? (arrangement.sections[0]?.label ?? arrangement.id) : arrangement.id}</h1>

      {attemptStatus === 'idle' && (
        <Card>
          <p>How should we play?</p>
          <p>
            <label>
              <input
                type="radio"
                name="mode"
                value="wait"
                checked={mode === 'wait'}
                onChange={() => setMode('wait')}
              />
              Wait for me
            </label>{' '}
            <label>
              <input
                type="radio"
                name="mode"
                value="timed"
                checked={mode === 'timed'}
                onChange={() => setMode('timed')}
              />
              Keep the beat
            </label>
          </p>

          {arrangement.tracks.length > 1 && (
            <p>
              Practise:{' '}
              {arrangement.tracks.map((t) => (
                <label key={t.id} style={{ marginRight: '1rem' }}>
                  <input
                    type="radio"
                    name="track"
                    value={t.id}
                    checked={selectedTrackId === t.id}
                    onChange={() => setSelectedTrackId(t.id)}
                  />
                  {' '}
                  {trackLabel(t)}
                </label>
              ))}
              <br />
              The other hand:{' '}
              <label style={{ marginRight: '1rem' }}>
                <input
                  type="radio"
                  name="accompaniment"
                  value="silent"
                  checked={accompaniment === 'silent'}
                  onChange={() => setAccompaniment('silent')}
                />
                {' '}
                Silent
              </label>
              <label>
                <input
                  type="radio"
                  name="accompaniment"
                  value="sampler"
                  checked={accompaniment === 'sampler'}
                  onChange={() => setAccompaniment('sampler')}
                />
                {' '}
                Played by the sampler
              </label>
            </p>
          )}

          <p>
            <label>
              <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
              Loop measures{' '}
            </label>
            <input
              type="number"
              min={1}
              max={totalMeasures}
              value={loopFromMeasure}
              disabled={!loopEnabled}
              onChange={(e) => setLoopFromMeasure(Number(e.target.value))}
              style={{ width: '3.5rem' }}
              aria-label="Loop from measure"
            />
            {' to '}
            <input
              type="number"
              min={1}
              max={totalMeasures}
              value={loopToMeasure}
              disabled={!loopEnabled}
              onChange={(e) => setLoopToMeasure(Number(e.target.value))}
              style={{ width: '3.5rem' }}
              aria-label="Loop to measure"
            />
            {' (of '}
            {totalMeasures}
            {')'}
          </p>
          {loopEnabled && (
            <p>
              <label>
                <input
                  type="checkbox"
                  checked={autoRampChecked}
                  onChange={(e) => setAutoRampChecked(e.target.checked)}
                />
                Auto-ramp tempo on a clean pass
              </label>
            </p>
          )}

          <p>Choose your piano:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {midiInputs.map((input) => (
              <Button key={input.id} accent="indigo" onClick={() => void handleSelectMidi(input.id)}>
                {input.name}
              </Button>
            ))}
          </div>
          <p>Connection: {midiConnectionState}</p>
        </Card>
      )}

      {attemptStatus === 'playing' && loopRange && (
        <Card>
          <p>
            Looping — pass {passNumber}
            {autoRampEnabled ? ` — tempo ${Math.round(tempoScale * 100)}%` : ''}
            {lastPassGrade ? ` — last pass ${Math.round(lastPassGrade.accuracy * 100)}% accurate` : ''}
          </p>
          <Button accent="indigo" variant="secondary" onClick={() => void stopLoop()}>
            Stop looping
          </Button>
        </Card>
      )}

      <Card>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            accent="indigo"
            variant={shownView === 'falling' ? 'primary' : 'secondary'}
            onClick={() => setView('falling')}
          >
            Falling notes
          </Button>
          {canShowNotation && (
            <Button
              accent="indigo"
              variant={view === 'notation' ? 'primary' : 'secondary'}
              onClick={() => setView('notation')}
            >
              Notation
            </Button>
          )}
          <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Tempo {Math.round(tempoScale * 100)}%
            <input
              type="range"
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              step={TEMPO_STEP}
              value={Math.round(tempoScale * 100)}
              onChange={(e) => setTempoScale(Number(e.target.value) / 100)}
            />
          </label>
        </div>
      </Card>

      {shownView === 'falling' && attemptStatus === 'playing' && clock && (
        <FallingNotesCanvas
          clock={clock}
          notes={notesForDisplay}
          keyboardRange={profile.keyboardRange}
          pendingGroupId={pendingGroupId}
        />
      )}

      {shownView === 'notation' && (
        <Card>
          <NotationView
            arrangement={arrangement}
            trackId={track.id}
            groupIndex={matcherState?.groupIndex ?? 0}
            attemptStatus={attemptStatus}
            grade={grade}
          />
        </Card>
      )}

      {attemptStatus === 'complete' && grade && (
        <Card>
          <p>
            Accuracy: {Math.round(grade.accuracy * 100)}% — {'⭐'.repeat(grade.stars)}
          </p>
          <p>You are {describeRushDrag(grade.rushDragMs)}.</p>
          {describeArticulation(grade) && <p>{describeArticulation(grade)}</p>}
          {grade.evennessCv !== undefined && <p>{describeEvenness(grade.evennessCv)}</p>}
        </Card>
      )}
    </PageShell>
  );
}
