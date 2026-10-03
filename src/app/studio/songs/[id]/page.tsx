// TA-APP-003 `/studio/songs/[id]` — US-3.14, lead-sheet song mode
// (FR-STU-013). Reuses sessionStore's existing MIDI/clock/matcher wiring,
// same pattern as `/studio/play/[id]`, but simplified — no loop/tempo/
// notation toggle. Reuses the existing falling-notes renderer (TA-REN-001)
// for the melody, with chord symbols overlaid as text at tick position —
// not a new renderer, per FR-STU-013.

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSessionStore } from '../../../../runtime/stores/sessionStore';
import { getAdapters } from '../../../../runtime/bootstrap';
import { FallingNotesCanvas } from '../../../../ui/falling/FallingNotesCanvas';
import { PageShell } from '../../../../ui/shared/PageShell';
import { Card } from '../../../../ui/shared/Card';
import { Button } from '../../../../ui/shared/Button';
import type { Arrangement } from '../../../../core/content/types';
import { describeRushDrag } from '../../../../core/grade/grade';

export default function StudioSongPage() {
  const params = useParams<{ id: string }>();
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

  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

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

  // FR-STU-013 — the melody track; the lead sheet's harmony comes from
  // arrangement.chordMarkers, not from a separate lh/accomp track.
  const track = arrangement?.tracks.find((t) => t.role === 'melody' || t.role === 'rh') ?? arrangement?.tracks[0];
  const notesForDisplay = activeNotes ?? track?.notes ?? [];

  async function handleSelectMidi(inputId: string): Promise<void> {
    if (!arrangement || !track) return;
    await selectMidiInput(inputId);
    await startArrangement(arrangement, track.id, crypto.randomUUID(), new Date().toISOString(), undefined, 'wait');
  }

  if (loadError) return <PageShell><p>Could not load this song: {loadError}</p></PageShell>;
  if (!arrangement || !track) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>{arrangement.id}</h1>

      {attemptStatus === 'idle' && (
        <Card>
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

      {attemptStatus === 'playing' && clock && (
        <FallingNotesCanvas
          clock={clock}
          notes={notesForDisplay}
          keyboardRange={profile.keyboardRange}
          pendingGroupId={undefined}
          {...(arrangement.chordMarkers ? { chordMarkers: arrangement.chordMarkers } : {})}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <Card>
          <p>
            Accuracy: {Math.round(grade.accuracy * 100)}% — {'⭐'.repeat(grade.stars)}
          </p>
          <p>You are {describeRushDrag(grade.rushDragMs)}.</p>
        </Card>
      )}
    </PageShell>
  );
}
