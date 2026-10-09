// TA-APP-003 `/studio/play/[id]` — US-3.01/US-3.02/US-3.03/US-3.05. Same
// MIDI-picker -> sessionStore wiring as `/explorer/play/[id]`, plus a
// falling-notes/notation view toggle and a tempo slider. No quest/section
// scoping, no session-arc integration, no "explorer floor" messaging — Studio
// grades honestly (sessionStore already gates the floor on profile.role).
// US-3.21 — controls on the shared tokens: a framed loop group, a pill
// view switch, a tempo readout, and the stage-style result.

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore, type AccompanimentMode, type PracticeMode } from '../../../../runtime/stores/sessionStore';
import { useGeneratedContentStore } from '../../../../runtime/stores/generatedContentStore';
import { getAdapters } from '../../../../runtime/bootstrap';
import { FallingNotesCanvas } from '../../../../ui/falling/FallingNotesCanvas';
import { ScrollingScore } from '../../../../ui/score/ScrollingScore';
import { useT, useNoteName } from '../../../../ui/i18n/useT';
import { PageShell } from '../../../../ui/shared/PageShell';
import { StatusNote } from '../../../../ui/shared/StatusNote';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import { MidiChooser } from '../../../../ui/shared/MidiChooser';
import { Segmented } from '../../../../ui/shared/Segmented';
import { Pill } from '../../../../ui/shared/Pill';
import controls from '../../../../ui/shared/Controls.module.css';
import { ResultCard } from '../../../../ui/shared/ResultCard';
import { usePieceTitle } from '../../../../ui/shared/usePieceTitle';
import type { Translator } from '../../../../core/i18n/translate';
import type { Arrangement, Track } from '../../../../core/content/types';
import { ticksPerMeasure } from '../../../../core/content/toMusicXml';
import { asTicks } from '../../../../core/time/types';
import { loadCustomArrangement, useCustomSongStore } from '../../../../runtime/stores/customSongStore';
import { isCustomSongId } from '../../../../core/content/customSong';
import { loadSongBytes, loadSongIndex } from '../../../../adapters/content/staticSongs';
import { parseSmf } from '../../../../core/midi/smf';
import { smfToArrangement } from '../../../../core/content/songLibrary';
import { detectKey, keyName, prefersSharps } from '../../../../core/content/detectKey';
import { transposeArrangement, transposeLimits } from '../../../../core/content/transpose';
import { describeArticulation, describeEvenness, describeRushDrag } from '../../../../core/grade/grade';

type StudioView = 'falling' | 'score';

const TEMPO_MIN = 30;
const TEMPO_MAX = 100;
const TEMPO_STEP = 5;

// FR-STU-005 — a plain-language label for a track's hand/role, since the
// child-facing icon-based labelling (Explorer) doesn't apply to Studio.
function trackLabel(t: Translator, track: Track): string {
  if (track.hand === 'L') return t('Left hand');
  if (track.hand === 'R') return t('Right hand');
  if (track.id === 'both') return t('Both hands');
  return t(track.role);
}

export default function StudioPlayPage() {
  const t = useT();
  const noteName = useNoteName();
  const params = useParams<{ id: string }>();
  const arrangementId = decodeURIComponent(params.id);
  const getGenerated = useGeneratedContentStore((s) => s.get);
  const customTitle = useCustomSongStore((s) => s.songs.find((x) => x.id === arrangementId)?.title);
  const loadCustomSongs = useCustomSongStore((s) => s.load);
  const activeProfileId = useSessionStore((s) => s.profile.id);
  useEffect(() => {
    if (isCustomSongId(arrangementId)) void loadCustomSongs();
  }, [arrangementId, loadCustomSongs, activeProfileId]);
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
  const endSession = useSessionStore((s) => s.endSession);

  // The session store outlives the page: without this, arriving from another piece shows that
  // piece's notes (and what was played in them) under this piece's title.
  useEffect(() => {
    endSession();
    return endSession;
  }, [endSession]);
  const setTempoScale = useSessionStore((s) => s.setTempoScale);
  const setLoopRange = useSessionStore((s) => s.setLoopRange);
  const setAutoRamp = useSessionStore((s) => s.setAutoRamp);
  const setAccompanimentMode = useSessionStore((s) => s.setAccompanimentMode);
  const stopLoop = useSessionStore((s) => s.stopLoop);
  const holdAtLine = useSessionStore((s) => s.holdAtLine);
  const setHoldAtLine = useSessionStore((s) => s.setHoldAtLine);
  const anyOctave = useSessionStore((s) => s.anyOctave);
  const setAnyOctave = useSessionStore((s) => s.setAnyOctave);

  // Octave matching is a per-piece choice, so it never leaks into the next screen.
  useEffect(() => () => setAnyOctave(false), [setAnyOctave]);

  const [loadedArrangement, setArrangement] = useState<Arrangement | undefined>();
  const [semitones, setSemitones] = useState(0);
  const restartOnTranspose = useRef(false);
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
    const generated = getGenerated(arrangementId);
    if (generated) {
      setArrangement(generated);
      setSelectedTrackId(generated.tracks[0]?.id);
      return;
    }
    let cancelled = false;
    setLoadError(undefined);
    // FR-STU-016 — a song from the library is a MIDI file converted on the spot.
    const load: Promise<Arrangement> = isCustomSongId(arrangementId)
      ? loadCustomArrangement(arrangementId)
      : arrangementId.startsWith('mutopia-')
      ? Promise.all([loadSongBytes(arrangementId), loadSongIndex().catch(() => undefined)]).then(([bytes, index]) => {
          if (!bytes) throw new Error('that song file is missing from this copy of the library');
          const parsed = parseSmf(bytes);
          if (!parsed.ok) throw new Error(parsed.error);
          const made = smfToArrangement(parsed.file, { id: arrangementId, title: index?.songs.find((x) => x.id === arrangementId)?.title ?? arrangementId });
          if (!made) throw new Error('that file has no notes');
          return made;
        })
      : getAdapters().content.arrangement(arrangementId);
    load
      .then((a) => {
        if (!cancelled) {
          setArrangement(a);
          setSelectedTrackId(a.tracks[0]?.id);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [arrangementId, getGenerated, profile.id]);

  // FR-STU-016 — the key is worked out from the notes; moving it changes every note, so what is
  // shown, graded and played all come from the moved copy.
  const detectedKey = useMemo(() => (loadedArrangement ? detectKey(loadedArrangement) : undefined), [loadedArrangement]);
  const limits = useMemo(
    () => (loadedArrangement ? transposeLimits(loadedArrangement, profile.keyboardRange.low as number, profile.keyboardRange.high as number) : { down: 0, up: 0 }),
    [loadedArrangement, profile.keyboardRange],
  );
  const arrangement = useMemo(
    () => (loadedArrangement ? transposeArrangement(loadedArrangement, semitones) : undefined),
    [loadedArrangement, semitones],
  );
  useEffect(() => setSemitones(0), [arrangementId]);

  const track = arrangement?.tracks.find((tr) => tr.id === selectedTrackId) ?? arrangement?.tracks[0];
  const notesForDisplay = useMemo(() => activeNotes ?? track?.notes ?? [], [activeNotes, track]);

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

  function changeSemitones(value: number): void {
    restartOnTranspose.current = attemptStatus === 'playing';
    setSemitones(value);
  }
  // After moving the key mid-play, start again on the moved notes.
  useEffect(() => {
    if (!restartOnTranspose.current || !arrangement || !track) return;
    restartOnTranspose.current = false;
    void startArrangement(arrangement, track.id, crypto.randomUUID(), new Date().toISOString(), undefined, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement]);

  const shownKey = detectedKey ? keyName((detectedKey.tonicPitchClass + semitones + 120) % 12, detectedKey.mode) : undefined;
  const sharps = detectedKey ? prefersSharps((detectedKey.tonicPitchClass + semitones + 120) % 12, detectedKey.mode) : true;

  const shownView: StudioView = view;
  const pieceTitle = usePieceTitle(arrangement?.pieceId);

  if (loadError) return <PageShell><StatusNote tone="problem">{t('Could not load this piece: {error}', { error: t(loadError) })}</StatusNote></PageShell>;
  if (!arrangement || !track) return <PageShell><StatusNote /></PageShell>;

  return (
    <PageShell back={{ href: '/studio/songs', label: t('Songs') }}>
      <h1>{t(customTitle ?? (arrangementId.startsWith('mutopia-') ? (arrangement.sections[0]?.label ?? arrangement.id) : (pieceTitle ?? arrangement.id)))}</h1>

      {attemptStatus === 'idle' && (
        <Card>
          <div className={controls.stack}>
            <Segmented
              name="mode"
              legend={t('How should we play?')}
              options={[
                { value: 'wait' as const, label: t('Wait for me') },
                { value: 'timed' as const, label: t('Keep the beat') },
              ]}
              value={mode}
              onChange={setMode}
            />
            {mode === 'wait' && (
              <label className={controls.check}>
                <input type="checkbox" checked={holdAtLine} onChange={(e) => setHoldAtLine(e.target.checked)} />
                {t('Stop the notes at the line until I play them')}
              </label>
            )}
            {mode === 'wait' && (
              <label className={controls.check}>
                <input type="checkbox" checked={anyOctave} onChange={(e) => setAnyOctave(e.target.checked)} />
                {t('Any octave counts (play the right letter on any part of the keyboard)')}
              </label>
            )}
            {arrangement.tracks.length > 1 && (
              <>
                <Segmented
                  name="track"
                  legend={t('Practise')}
                  options={arrangement.tracks.map((tr) => ({ value: tr.id, label: trackLabel(t, tr) }))}
                  value={selectedTrackId ?? track?.id ?? ''}
                  onChange={(id) => setSelectedTrackId(id)}
                />
                <Segmented
                  name="accompaniment"
                  legend={t('The other hand')}
                  options={[
                    { value: 'silent' as const, label: t('Silent') },
                    { value: 'sampler' as const, label: t('Played by the sampler') },
                  ]}
                  value={accompaniment}
                  onChange={setAccompaniment}
                />
              </>
            )}

            <fieldset className={controls.group}>
              <legend className={controls.legend}>{t('Loop')}</legend>
              <label className={controls.check}>
                <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
                {t('Repeat a few measures')}
              </label>
              <div className={controls.range}>
                <span className={controls.rangeLabel}>{t('Measures')}</span>
                <input
                  type="number"
                  min={1}
                  max={totalMeasures}
                  value={loopFromMeasure}
                  disabled={!loopEnabled}
                  onChange={(e) => setLoopFromMeasure(Number(e.target.value))}
                  aria-label={t('Loop from measure')}
                />
                <span className={controls.faint}>{t('to')}</span>
                <input
                  type="number"
                  min={1}
                  max={totalMeasures}
                  value={loopToMeasure}
                  disabled={!loopEnabled}
                  onChange={(e) => setLoopToMeasure(Number(e.target.value))}
                  aria-label={t('Loop to measure')}
                />
                <span className={controls.faint}>{t('of {total}', { total: totalMeasures })}</span>
              </div>
              {loopEnabled && (
                <label className={controls.check}>
                  <input
                    type="checkbox"
                    checked={autoRampChecked}
                    onChange={(e) => setAutoRampChecked(e.target.checked)}
                  />
                  {t('Speed up a little after each clean pass')}
                </label>
              )}
            </fieldset>

            <MidiChooser
              inputs={midiInputs}
              connectionState={midiConnectionState}
              onSelect={(id) => void handleSelectMidi(id)}
            />
          </div>
        </Card>
      )}

      {attemptStatus === 'playing' && loopRange && (
        <Card>
          <div className={controls.loopStatus} role="status">
            <Pill tone="solid">{t('Pass {n}', { n: passNumber })}</Pill>
            {autoRampEnabled && <Pill mono>{t('Tempo')} {Math.round(tempoScale * 100)}%</Pill>}
            {lastPassGrade && <Pill tone="neutral">{t('Last pass {percent}% accurate', { percent: Math.round(lastPassGrade.accuracy * 100) })}</Pill>}
          </div>
          <Button accent="indigo" variant="secondary" onClick={() => void stopLoop()}>
            {t('Stop looping')}
          </Button>
        </Card>
      )}

      <Card>
        <div className={controls.bar}>
          <Segmented
            name="view"
            legend={t('Show')}
            options={[
              { value: 'falling' as const, label: t('Falling notes') },
              { value: 'score' as const, label: t('Music score') },
            ]}
            value={shownView}
            onChange={setView}
          />
          <label className={controls.tempo}>
            <span className={controls.tempoLabel}>
              {t('Key')}{shownKey ? ` (${t(shownKey)})` : ''}
            </span>
            <select value={String(semitones)} onChange={(e) => changeSemitones(Number(e.target.value))} aria-label={t('Move the key')}>
              {Array.from({ length: 25 }, (_, i) => i - 12).map((n) => (
                <option key={n} value={String(n)} disabled={n < limits.down || n > limits.up}>
                  {n === 0 ? t('As written') : n > 0 ? t('{n} higher', { n }) : t('{n} lower', { n: -n })}
                  {detectedKey ? ` — ${t(keyName((detectedKey.tonicPitchClass + n + 120) % 12, detectedKey.mode))}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className={controls.tempo}>
            <span className={controls.tempoLabel}>
              {t('Tempo')} <span className={controls.readout}>{Math.round(tempoScale * 100)}%</span>
            </span>
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

      {attemptStatus === 'playing' && mode === 'wait' && holdAtLine && matcherState && matcherState.pending.length > 0 && (
        <p aria-live="polite">
          <strong>{t('Waiting for you. Play:')}</strong>{' '}
          {[...matcherState.pending].sort((a, b) => (a as number) - (b as number)).map((p) => noteName(p as number, !anyOctave)).join(' · ')}
        </p>
      )}

      {shownView === 'falling' && attemptStatus === 'playing' && clock && (
        <FallingNotesCanvas
          clock={clock}
          notes={notesForDisplay}
          keyboardRange={profile.keyboardRange}
          matcherState={matcherState}
          anyOctave={anyOctave}
        />
      )}

      {shownView === 'score' && (
        <ScrollingScore
          arrangement={arrangement}
          trackId={track.id}
          groupIndex={matcherState?.groupIndex ?? 0}
          preferSharps={sharps}
          isFinished={attemptStatus === 'complete'}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <ResultCard stars={grade.stars} title={t('{percent}% of the notes', { percent: Math.round(grade.accuracy * 100) })}>
          <p>{t('You are {how}.', { how: t(describeRushDrag(grade.rushDragMs)) })}</p>
          {describeArticulation(grade) && <p>{t(describeArticulation(grade) ?? '')}</p>}
          {grade.evennessCv !== undefined && <p>{t(describeEvenness(grade.evennessCv))}</p>}
        </ResultCard>
      )}
    </PageShell>
  );
}
