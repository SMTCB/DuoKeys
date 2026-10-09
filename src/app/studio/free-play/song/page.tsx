// TA-APP-003 `/studio/free-play/song` — FR-STU-020, "make me a song". A few minutes of
// music written from the chord catalogue (freePlaySong.ts): intro, verses, choruses, a
// bridge and an ending, the left hand on a bass pattern and the right on a simple tune.
// The query carries the seed, so "play it again" is the same song and a link is a song.
//
// Two switches work while the song plays: "keep going" swaps waiting for each note for
// playing on in time (sessionStore.switchMode keeps what was already played), and
// "make up my own right hand" drops the written tune, keeps the bass, and lights the keys
// that fit the chord. That one starts the song again, since what is being played changes.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSessionStore } from '../../../../runtime/stores/sessionStore';
import { useChordExplorerStore } from '../../../../runtime/stores/chordExplorerStore';
import { asPitchClass } from '../../../../core/content/chordTypes';
import { composeSong, freePlaySongHref, harmonyAt, partAt, type SongRequest } from '../../../../core/content/freePlaySong';
import { PPQ } from '../../../../core/time/types';
import { chordSymbolOfId } from '../../../../core/content/chordSymbols';
import { useLocale, useT, useNoteName } from '../../../../ui/i18n/useT';
import { translateSongTitle } from '../../../../core/i18n/songTitle';
import { FallingNotesCanvas, type FitGlow } from '../../../../ui/falling/FallingNotesCanvas';
import { ScrollingScore } from '../../../../ui/score/ScrollingScore';
import controls from '../../../../ui/shared/Controls.module.css';
import { PageShell } from '../../../../ui/shared/PageShell';
import { StatusNote } from '../../../../ui/shared/StatusNote';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import { Pill } from '../../../../ui/shared/Pill';
import { MidiChooser } from '../../../../ui/shared/MidiChooser';
import { Segmented } from '../../../../ui/shared/Segmented';
import { ResultCard } from '../../../../ui/shared/ResultCard';

type PlayView = 'falling' | 'score';

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TEMPO_MIN = 30;
const TEMPO_MAX = 100;
const TEMPO_STEP = 5;
const POSITION_REFRESH_MS = 250;

function newSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

/** The song asked for in the address bar; anything missing is filled in. */
function readRequest(search: string): SongRequest {
  const q = new URLSearchParams(search);
  const seed = Number(q.get('seed'));
  const key = q.get('key');
  const length = q.get('length');
  const mood = q.get('mood');
  return {
    seed: Number.isFinite(seed) && seed > 0 ? seed : newSeed(),
    length: length === 'short' || length === 'long' ? length : 'song',
    level: q.get('level') === '2' ? 2 : 1,
    ...(mood ? { mood } : {}),
    ...(key !== null && key !== '' && Number(key) >= 0 && Number(key) < 12 ? { key: asPitchClass(Number(key)) } : {}),
  };
}

export default function FreePlaySongPage() {
  const t = useT();
  const locale = useLocale();
  const noteName = useNoteName();
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
  const practiceMode = useSessionStore((s) => s.practiceMode);
  const pressedPitches = useSessionStore((s) => s.pressedPitches);
  const setTempoScale = useSessionStore((s) => s.setTempoScale);
  const switchMode = useSessionStore((s) => s.switchMode);
  const setAnyOctave = useSessionStore((s) => s.setAnyOctave);
  const setHoldAtLine = useSessionStore((s) => s.setHoldAtLine);
  const setAccompanimentMode = useSessionStore((s) => s.setAccompanimentMode);
  const refreshMidiInputs = useSessionStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useSessionStore((s) => s.selectMidiInput);
  const startArrangement = useSessionStore((s) => s.startArrangement);
  const endSession = useSessionStore((s) => s.endSession);

  const [request, setRequest] = useState<SongRequest | undefined>();
  const [view, setView] = useState<PlayView>('falling');
  const [isImprovising, setImprovising] = useState(false);
  const [nowTick, setNowTick] = useState(0);

  // A song is played note for note: the exact key, held at the line while waiting, nothing played for you.
  useEffect(() => {
    setAnyOctave(false);
    setHoldAtLine(true);
    setAccompanimentMode('silent');
  }, [setAnyOctave, setHoldAtLine, setAccompanimentMode]);

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  useEffect(() => {
    endSession();
    return endSession;
  }, [endSession]);

  // Read after mount: useSearchParams would force a Suspense boundary.
  useEffect(() => {
    setRequest(readRequest(window.location.search));
  }, []);

  const song = useMemo(() => (catalogue && request ? composeSong(catalogue, request) : undefined), [catalogue, request]);
  const trackId = isImprovising ? 'lh' : 'both';
  const track = song?.arrangement.tracks.find((tr) => tr.id === trackId);
  // The score draws every track it is given, so it gets only the one being played.
  const scoreArrangement = useMemo(
    () => (song && track ? { ...song.arrangement, tracks: [track] } : undefined),
    [song, track],
  );
  const glow = useMemo<FitGlow | undefined>(
    () => (song && isImprovising ? { windows: song.harmony, low: song.rightHandRange.low, high: song.rightHandRange.high } : undefined),
    [song, isImprovising],
  );

  // The form strip and the chord name follow the music, which moves on its own when playing in time.
  useEffect(() => {
    if (!clock || attemptStatus !== 'playing') return;
    const id = window.setInterval(() => setNowTick(clock.audioToTicks(clock.nowAudio()) as number), POSITION_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [clock, attemptStatus]);

  async function start(options: { inputId?: string; improvise?: boolean } = {}): Promise<void> {
    if (!song) return;
    if (options.inputId !== undefined) await selectMidiInput(options.inputId);
    const improvise = options.improvise ?? isImprovising;
    setNowTick(0);
    await startArrangement(song.arrangement, improvise ? 'lh' : 'both', crypto.randomUUID(), new Date().toISOString(), undefined, useSessionStore.getState().practiceMode);
  }

  function toggleImprovise(on: boolean): void {
    setImprovising(on);
    // What is being played changes, so the song starts again from the top.
    if (attemptStatus === 'playing') void start({ improvise: on });
  }

  function anotherSong(): void {
    if (!request) return;
    const next = { ...request, seed: newSeed() };
    endSession();
    setRequest(next);
    window.history.replaceState(null, '', freePlaySongHref(next));
  }

  if (!catalogue || !request) return <PageShell><StatusNote /></PageShell>;
  if (!song || !track || !scoreArrangement) {
    return (
      <PageShell>
        <p>{t('There are no easy progressions to write a song from.')}</p>
        <Link href="/studio/free-play">{t('Back to Free play')}</Link>
      </PageShell>
    );
  }

  const keyLabel = `${KEY_NAMES[song.key as number]}${song.mode === 'minor' ? ` ${t('minor')}` : ''}`;
  const songTitle = translateSongTitle(locale, song.title);
  const totalSeconds = ((song.parts[song.parts.length - 1]?.endTick as number) / PPQ / song.bpm) * 60;
  const currentPart = attemptStatus === 'playing' ? partAt(song.parts, nowTick) : undefined;
  const currentChord = attemptStatus === 'playing' ? harmonyAt(song.harmony, nowTick) : undefined;
  const currentSymbol = currentChord ? song.arrangement.chordMarkers?.filter((m) => (m.atTick as number) <= nowTick).at(-1)?.symbol : undefined;
  const isFlowing = practiceMode === 'timed';
  // The notes still wanted in the current chord, split by hand, for the line above the falling notes.
  const pendingGroupId = matcherState ? [...new Set(track.notes.map((n) => n.groupId))][matcherState.groupIndex] : undefined;
  const handNotes = (hand: 'L' | 'R'): string =>
    [...new Set(track.notes.filter((n) => n.groupId === pendingGroupId && n.hand === hand && matcherState?.pending.includes(n.pitch)).map((n) => n.pitch as number))]
      .sort((a, b) => a - b)
      .map((p) => noteName(p))
      .join(' · ');

  // Two ways to play, named up front; either can be switched while playing.
  const modeChoice = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
      <Segmented
        name="song-mode"
        legend={t('How do you want to play?')}
        options={[
          { value: 'song' as const, label: t('Play the song') },
          { value: 'improvise' as const, label: t('Chords and improvise') },
        ]}
        value={isImprovising ? 'improvise' : 'song'}
        onChange={(v) => toggleImprovise(v === 'improvise')}
      />
      <p style={{ margin: 0 }}>
        {isImprovising
          ? t('Your left hand plays the chords (dark bars, L). With your right hand, play any lit key: they all fit.')
          : t('The left hand plays the chords as a bass line (dark bars, L). The right hand plays a simple tune (light bars, R).')}
      </p>
    </div>
  );
  const switches = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'flex-start' }}>
      {modeChoice}
      <label className={controls.check}>
        <input type="checkbox" checked={isFlowing} onChange={(e) => switchMode(e.target.checked ? 'timed' : 'wait')} />
        {t('Keep going (don’t wait for me)')}
      </label>
    </div>
  );

  return (
    <PageShell back={{ href: '/studio/free-play', label: t('Free play') }}>
      <h1>{songTitle}</h1>
      <p style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', margin: 0 }}>
        <Pill tone="neutral">{t('Key of {key}', { key: keyLabel })}</Pill>
        {song.moods.map((m) => (
          <Pill key={m} tone={m === request.mood ? 'solid' : 'neutral'}>{t(m)}</Pill>
        ))}
        <span>{t('about {min} min at full speed', { min: Math.max(1, Math.round(totalSeconds / 60)) })}</span>
      </p>
      <ol aria-label={t('The song, part by part')} style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', listStyle: 'none', padding: 0 }}>
        {song.parts.map((part, i) => {
          const isNow = part === currentPart;
          return (
            <li key={i} aria-current={isNow ? 'step' : undefined}>
              <Pill tone={isNow ? 'solid' : 'neutral'}>
                {isNow ? '▶ ' : ''}
                {t(part.label)}
              </Pill>
            </li>
          );
        })}
      </ol>

      {attemptStatus === 'idle' && (
        <Card>
          <p>
            <strong>{t('The goal:')}</strong>{' '}
            {t('play the chords of this song from start to finish, about {min} min. The verse and chorus come back, so you know what is coming.', { min: Math.max(1, Math.round(totalSeconds / 60)) })}
          </p>
          <p>
            {t('Chords:')}{' '}
            {[...new Set(song.parts.slice(1, -1).map((p) => p.progressionId))]
              .map((id) => catalogue.progressions.find((p) => p.id === id)?.chordIds.map(chordSymbolOfId).join(' '))
              .join('  ·  ')}
          </p>
          {switches}
          <p>{t('You can change how you play at any time.')}</p>
          <MidiChooser inputs={midiInputs} connectionState={midiConnectionState} onSelect={(id) => void start({ inputId: id })} />
        </Card>
      )}

      {attemptStatus === 'playing' && clock && (
        <Card>
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
            <label className={controls.tempo}>
              <span className={controls.tempoLabel}>
                {t('Speed')} <span className={controls.readout}>{Math.round(tempoScale * 100)}%</span>
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
          {switches}
        </Card>
      )}

      {attemptStatus === 'playing' && (
        <p aria-live="polite">
          {currentPart && <strong>{t(currentPart.label)}</strong>}
          {currentSymbol && <> · {t('chord')} <strong>{currentSymbol}</strong></>}
          {!isFlowing && matcherState && matcherState.pending.length > 0 && (
            <>
              {' '}· {t('Left hand:')} <strong>{handNotes('L') || '–'}</strong>
              {' '}· {t('Right hand:')} <strong>{isImprovising ? t('any lit key') : handNotes('R') || '–'}</strong>
            </>
          )}
          {isFlowing && isImprovising && <> · {t('Right hand:')} <strong>{t('any lit key')}</strong></>}
        </p>
      )}

      {attemptStatus === 'playing' && clock && view === 'falling' && (
        <FallingNotesCanvas
          clock={clock}
          notes={activeNotes ?? track.notes}
          keyboardRange={profile.keyboardRange}
          matcherState={matcherState}
          pressedPitches={pressedPitches}
          glow={glow}
          handLabels={{ L: t('L'), R: t('R') }}
          {...(song.arrangement.chordMarkers ? { chordMarkers: song.arrangement.chordMarkers } : {})}
        />
      )}

      {attemptStatus === 'playing' && view === 'score' && (
        <ScrollingScore
          arrangement={scoreArrangement}
          trackId={trackId}
          groupIndex={matcherState?.groupIndex ?? 0}
          isFinished={false}
          notes={activeNotes ?? undefined}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <ResultCard
          stars={grade.stars}
          title={`${songTitle}: ${isImprovising ? t('{percent}% of the bass notes', { percent: Math.round(grade.accuracy * 100) }) : t('{percent}% of the notes', { percent: Math.round(grade.accuracy * 100) })}`}
          actions={
            <span style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Button accent="indigo" onClick={() => void start()}>
                {t('Play it again')}
              </Button>
              <Button accent="indigo" variant="secondary" onClick={anotherSong}>
                {t('New song, same feeling')}
              </Button>
            </span>
          }
        >
          <p>{t('That’s the whole song. Play it again and it will be the same tune; a new one is written each time you ask.')}</p>
        </ResultCard>
      )}
    </PageShell>
  );
}
