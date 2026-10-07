// TA-APP-003 `/studio/chords/play/[progressionId]` — FR-STU-015, a chord
// progression played with falling notes. The progression becomes an in-memory
// Arrangement (progressionArrangement.ts) and runs through the same wait-mode
// session and falling-notes view as a song: the notes wait for you, there is
// no timer and no failure state (FR-STU-012's free-play philosophy).

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { sameProgressionInKey } from '../../../../../core/content/freePlay';
import { asPitchClass } from '../../../../../core/content/chordTypes';
import { useSessionStore } from '../../../../../runtime/stores/sessionStore';
import { useChordExplorerStore } from '../../../../../runtime/stores/chordExplorerStore';
import { noteName } from '../../../../../ui/falling/noteName';
import { ProgressionNav } from '../../../../../ui/shared/ProgressionNav';
import { progressionPosition } from '../../../../../core/content/progressionPosition';
import { chordSymbolOfId } from '../../../../../core/content/chordSymbols';
import { FallingNotesCanvas } from '../../../../../ui/falling/FallingNotesCanvas';
import { ScrollingScore } from '../../../../../ui/score/ScrollingScore';
import { Pill } from '../../../../../ui/shared/Pill';
import controls from '../../../../../ui/shared/Controls.module.css';
import { PageShell } from '../../../../../ui/shared/PageShell';
import { StatusNote } from '../../../../../ui/shared/StatusNote';
import { Card } from '../../../../../ui/shared/Card';
import { Button } from '../../../../../ui/shared/Button';
import { MidiChooser } from '../../../../../ui/shared/MidiChooser';
import stage from '../../../../../ui/shared/Stage.module.css';
import { Segmented } from '../../../../../ui/shared/Segmented';
import { progressionToArrangement } from '../../../../../core/content/progressionArrangement';
import {
  CHORD_STYLES,
  styleFilePath,
  styledProgressionToArrangement,
  type ChordStyleId,
} from '../../../../../core/content/styledProgression';
import { parseSmf, type SmfFile } from '../../../../../core/midi/smf';
import { loadChordStyleBytes } from '../../../../../adapters/content/staticChords';

type StyleChoice = 'block' | ChordStyleId;
type PlayView = 'falling' | 'score';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const TEMPO_MIN = 30;
const TEMPO_MAX = 100;
const TEMPO_STEP = 5;

export default function ChordProgressionPlayPage() {
  const params = useParams<{ progressionId: string }>();
  const restartOnKeyChange = useRef(false);
  // Held in state so a key change can swap it without re-rendering the route (which would drop a game in play).
  const [progressionId, setProgressionId] = useState(() => decodeURIComponent(params.progressionId));

  const catalogue = useChordExplorerStore((s) => s.catalogue);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);

  const profile = useSessionStore((s) => s.profile);
  const midiInputs = useSessionStore((s) => s.midiInputs);
  const midiConnectionState = useSessionStore((s) => s.midiConnectionState);
  const clock = useSessionStore((s) => s.clock);
  const activeNotes = useSessionStore((s) => s.activeNotes);
  const attemptStatus = useSessionStore((s) => s.attemptStatus);
  const grade = useSessionStore((s) => s.grade);
  const matcherState = useSessionStore((s) => s.matcherState);
  const tempoScale = useSessionStore((s) => s.tempoScale);
  const holdAtLine = useSessionStore((s) => s.holdAtLine);
  const anyOctave = useSessionStore((s) => s.anyOctave);
  const pressedPitches = useSessionStore((s) => s.pressedPitches);
  const setAnyOctave = useSessionStore((s) => s.setAnyOctave);
  const setTempoScale = useSessionStore((s) => s.setTempoScale);
  const setHoldAtLine = useSessionStore((s) => s.setHoldAtLine);
  const refreshMidiInputs = useSessionStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useSessionStore((s) => s.selectMidiInput);
  const startArrangement = useSessionStore((s) => s.startArrangement);
  const endSession = useSessionStore((s) => s.endSession);

  // A chord drill accepts the right letter in any octave; the store flag is put back on leaving so songs stay exact.
  useEffect(() => {
    setAnyOctave(true);
    return () => setAnyOctave(false);
  }, [setAnyOctave]);

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  // The session store outlives the page: without this, arriving from another attempt shows its
  // notes (and what was played in them) instead of the idle card for this progression.
  useEffect(() => {
    endSession();
    return endSession;
  }, [endSession]);

  const progression = catalogue?.progressions.find((p) => p.id === progressionId);
  const [style, setStyle] = useState<StyleChoice>('block');
  const [view, setView] = useState<PlayView>('falling');

  // FR-STU-018 — Free play links here with ?style=pop so the suggested rhythm is already chosen.
  // Read from the address bar after mount: useSearchParams would force a Suspense boundary.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('style');
    if (wanted && CHORD_STYLES.some((s) => s.id === wanted)) setStyle(wanted as ChordStyleId);
  }, []);
  const [styleFile, setStyleFile] = useState<SmfFile | undefined>(undefined);
  const [styleError, setStyleError] = useState(false);

  // FR-STU-015: a rhythmic style is fetched and parsed on choosing it; 'block' needs no file.
  // Keyed on the file's path, which does not change with the key, so transposing keeps the loaded rhythm.
  const stylePath = style !== 'block' && progression ? styleFilePath(style, progression) : undefined;
  useEffect(() => {
    setStyleFile(undefined);
    setStyleError(false);
    const path = stylePath;
    if (!path) return;
    let cancelled = false;
    void loadChordStyleBytes(path)
      .then((bytes) => {
        const parsed = bytes ? parseSmf(bytes) : undefined;
        if (cancelled) return;
        if (parsed?.ok) setStyleFile(parsed.file);
        else setStyleError(true);
      })
      .catch(() => {
        if (!cancelled) setStyleError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [stylePath]);

  const arrangement = useMemo(() => {
    if (!catalogue || !progression) return undefined;
    const styled = styleFile ? styledProgressionToArrangement(progression, catalogue.chords, styleFile) : undefined;
    return styled ?? progressionToArrangement(progression, catalogue.chords);
  }, [catalogue, progression, styleFile]);
  const isNumeralName = progression !== undefined && /^[b#♭♯]?[ivIV]+/.test(progression.name);
  const hasStyles = progression ? styleFilePath('pop', progression) !== undefined : false;
  const isStyleLoading = style !== 'block' && hasStyles && !styleFile && !styleError;

  const shownView: PlayView = view;

  const position =
    arrangement && progression && attemptStatus === 'playing'
      ? progressionPosition(
          arrangement.chordMarkers ?? [],
          activeNotes ?? arrangement.tracks[0]?.notes ?? [],
          matcherState?.groupIndex ?? 0,
          progression.chordIds.length,
        )
      : undefined;

  // The same progression in another key keeps its degrees, so it keeps its mood.
  function changeKey(value: string): void {
    if (!catalogue || !progression) return;
    const moved = sameProgressionInKey(catalogue.progressions, progression, asPitchClass(Number(value)));
    if (!moved) return;
    restartOnKeyChange.current = attemptStatus === 'playing';
    setProgressionId(moved.id);
    window.history.replaceState(null, '', `/studio/chords/play/${encodeURIComponent(moved.id)}${style === 'block' ? '' : `?style=${style}`}`);
  }
  const keyPicker = progression && !progression.isUserAdded && (
    <label className={controls.tempo}>
      <span className={controls.tempoLabel}>Key</span>
      <select value={String(progression.key)} onChange={(e) => changeKey(e.target.value)} aria-label="Key">
        {KEY_NAMES.map((name, i) => (
          <option key={name} value={String(i)}>
            {name}
            {progression.mode === 'minor' ? ' minor' : ''}
          </option>
        ))}
      </select>
    </label>
  );

  // After a key change mid-play, start again on the transposed notes.
  useEffect(() => {
    if (!restartOnKeyChange.current || !arrangement) return;
    restartOnKeyChange.current = false;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement]);

  async function start(inputId?: string): Promise<void> {
    if (!arrangement) return;
    if (inputId !== undefined) await selectMidiInput(inputId);
    await startArrangement(arrangement, 'chords', crypto.randomUUID(), new Date().toISOString(), undefined, 'wait');
  }

  if (!catalogue) return <PageShell><StatusNote /></PageShell>;
  if (!progression || !arrangement) {
    return (
      <PageShell>
        <p>That progression is not in your library.</p>
        <Link href="/studio/chords">Back to the chord explorer</Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1>{progression.name}</h1>
      <p>
        <Link href="/studio/chords">← Chord explorer</Link>
      </p>
      <p style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', margin: 0 }}>
        <Pill tone="neutral">
          Key of {KEY_NAMES[progression.key as number]}
          {progression.mode === 'minor' ? ' minor' : ''}
        </Pill>
        {progression.moods.map((m) => (
          <Pill key={m} tone="neutral">{m}</Pill>
        ))}
        <strong>{progression.chordIds.map((id) => chordSymbolOfId(id)).join('  ')}</strong>
      </p>
      {isNumeralName && (
        <p>
          {progression.name} is the pattern: each number is a step of the scale (I is the home chord, V the tension
          chord that wants to go home). Capitals are major chords, small letters minor. The chords above are that
          pattern in this key.
        </p>
      )}

      {attemptStatus === 'idle' && (
        <Card>
          {hasStyles && (
            <Segmented
              name="rhythm"
              legend="Rhythm (the pattern the chords are played in)"
              options={([{ id: 'block', label: 'Block chords' }, ...CHORD_STYLES] as { id: StyleChoice; label: string }[]).map((choice) => ({
                value: choice.id,
                label: choice.label,
              }))}
              value={style}
              onChange={setStyle}
            />
          )}
          {keyPicker}
          {styleError && <p>That rhythm could not be loaded — block chords will play instead.</p>}
          {isStyleLoading && <p>Loading the rhythm…</p>}
          <label className={controls.check}>
            <input type="checkbox" checked={holdAtLine} onChange={(e) => setHoldAtLine(e.target.checked)} />
            Stop the chord at the line until I play it
          </label>
          <label className={controls.check}>
            <input type="checkbox" checked={anyOctave} onChange={(e) => setAnyOctave(e.target.checked)} />
            Any octave counts (play the right letter wherever it is easiest)
          </label>
          <p>The chords wait for you — there is no timer.</p>
          <MidiChooser inputs={midiInputs} connectionState={midiConnectionState} onSelect={(id) => void start(id)} />
        </Card>
      )}

      {attemptStatus === 'playing' && clock && (
        <Card>
          <div className={controls.bar}>
            <Segmented
              name="view"
              legend="Show"
              options={[
                { value: 'falling' as const, label: 'Falling notes' },
                { value: 'score' as const, label: 'Music score' },
              ]}
              value={shownView}
              onChange={setView}
            />
            {keyPicker}
            <label className={controls.tempo}>
              <span className={controls.tempoLabel}>
                Speed <span className={controls.readout}>{Math.round(tempoScale * 100)}%</span>
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
      )}

      {attemptStatus === 'playing' && position && (
        <ProgressionNav
          symbols={progression.chordIds.map((id) => chordSymbolOfId(id))}
          currentIndex={position.chordIndex}
          round={position.round}
          totalRounds={position.totalRounds}
        />
      )}

      {attemptStatus === 'playing' && matcherState && matcherState.pending.length > 0 && (
        <p aria-live="polite">
          <strong>Play now:</strong>{' '}
          {[...matcherState.pending].sort((a, b) => (a as number) - (b as number)).map((p) => noteName(p as number, !anyOctave)).join(' · ')}
        </p>
      )}

      {attemptStatus === 'playing' && clock && shownView === 'falling' && (
        <FallingNotesCanvas
          clock={clock}
          notes={activeNotes ?? arrangement.tracks[0]?.notes ?? []}
          keyboardRange={profile.keyboardRange}
          matcherState={matcherState}
          anyOctave={anyOctave}
          pressedPitches={pressedPitches}
          stageChords
          {...(arrangement.chordMarkers ? { chordMarkers: arrangement.chordMarkers } : {})}
        />
      )}

      {attemptStatus === 'playing' && shownView === 'score' && (
        <ScrollingScore
          arrangement={arrangement}
          trackId="chords"
          groupIndex={matcherState?.groupIndex ?? 0}
          isFinished={false}
          notes={activeNotes ?? undefined}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <Card>
          <div className={stage.stars} aria-label={`${grade.stars} stars`}>
            {'⭐'.repeat(grade.stars)}
          </div>
          <p className={stage.title}>Round finished — {Math.round(grade.accuracy * 100)}% of the chord notes</p>
          <Button accent="indigo" onClick={() => void start()}>
            Play it again
          </Button>
        </Card>
      )}
    </PageShell>
  );
}
