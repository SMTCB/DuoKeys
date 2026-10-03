// TA-APP-003 `/studio/chords/play/[progressionId]` — FR-STU-015, a chord
// progression played with falling notes. The progression becomes an in-memory
// Arrangement (progressionArrangement.ts) and runs through the same wait-mode
// session and falling-notes view as a song: the notes wait for you, there is
// no timer and no failure state (FR-STU-012's free-play philosophy).

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSessionStore } from '../../../../../runtime/stores/sessionStore';
import { useChordExplorerStore } from '../../../../../runtime/stores/chordExplorerStore';
import { FallingNotesCanvas } from '../../../../../ui/falling/FallingNotesCanvas';
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

export default function ChordProgressionPlayPage() {
  const params = useParams<{ progressionId: string }>();
  const progressionId = decodeURIComponent(params.progressionId);

  const catalogue = useChordExplorerStore((s) => s.catalogue);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);

  const profile = useSessionStore((s) => s.profile);
  const midiInputs = useSessionStore((s) => s.midiInputs);
  const midiConnectionState = useSessionStore((s) => s.midiConnectionState);
  const clock = useSessionStore((s) => s.clock);
  const activeNotes = useSessionStore((s) => s.activeNotes);
  const attemptStatus = useSessionStore((s) => s.attemptStatus);
  const grade = useSessionStore((s) => s.grade);
  const refreshMidiInputs = useSessionStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useSessionStore((s) => s.selectMidiInput);
  const startArrangement = useSessionStore((s) => s.startArrangement);

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  const progression = catalogue?.progressions.find((p) => p.id === progressionId);
  const [style, setStyle] = useState<StyleChoice>('block');
  const [styleFile, setStyleFile] = useState<SmfFile | undefined>(undefined);
  const [styleError, setStyleError] = useState(false);

  // FR-STU-015: a rhythmic style is fetched and parsed on choosing it; 'block' needs no file.
  useEffect(() => {
    setStyleFile(undefined);
    setStyleError(false);
    if (style === 'block' || !progression) return;
    const path = styleFilePath(style, progression);
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
  }, [style, progression]);

  const arrangement = useMemo(() => {
    if (!catalogue || !progression) return undefined;
    const styled = styleFile ? styledProgressionToArrangement(progression, catalogue.chords, styleFile) : undefined;
    return styled ?? progressionToArrangement(progression, catalogue.chords);
  }, [catalogue, progression, styleFile]);
  const hasStyles = progression ? styleFilePath('pop', progression) !== undefined : false;
  const isStyleLoading = style !== 'block' && hasStyles && !styleFile && !styleError;

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

      {attemptStatus === 'idle' && (
        <Card>
          {hasStyles && (
            <Segmented
              name="rhythm"
              legend="Rhythm"
              options={([{ id: 'block', label: 'Block chords' }, ...CHORD_STYLES] as { id: StyleChoice; label: string }[]).map((choice) => ({
                value: choice.id,
                label: choice.label,
              }))}
              value={style}
              onChange={setStyle}
            />
          )}
          {styleError && <p>That rhythm could not be loaded — block chords will play instead.</p>}
          {isStyleLoading && <p>Loading the rhythm…</p>}
          <p>The chords fall and wait for you.</p>
          <MidiChooser inputs={midiInputs} connectionState={midiConnectionState} onSelect={(id) => void start(id)} />
        </Card>
      )}

      {attemptStatus === 'playing' && clock && (
        <FallingNotesCanvas
          clock={clock}
          notes={activeNotes ?? arrangement.tracks[0]?.notes ?? []}
          keyboardRange={profile.keyboardRange}
          pendingGroupId={undefined}
          {...(arrangement.chordMarkers ? { chordMarkers: arrangement.chordMarkers } : {})}
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
