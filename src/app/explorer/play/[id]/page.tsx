// TA-APP-003 `/explorer/play/[id]` — falling-notes practice, wait mode
// (US-1.10/1.11/1.13). Client component: it owns the MIDI device picker, the
// live falling-notes canvas, and the post-attempt star display. All matching
// and grading happen in core/ via the sessionStore wiring; this component
// only reads state and dispatches the three session actions.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSessionStore } from '../../../../runtime/stores/sessionStore';
import { FallingNotesCanvas } from '../../../../ui/falling/FallingNotesCanvas';
import type { Arrangement } from '../../../../core/content/types';

export default function ExplorerPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const sectionId = searchParams.get('section') ?? undefined;
  const adapters = useSessionStore((s) => s.adapters);
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

  const [arrangement, setArrangement] = useState<Arrangement | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();

  useEffect(() => {
    void refreshMidiInputs();
  }, [refreshMidiInputs]);

  useEffect(() => {
    let cancelled = false;
    adapters.content
      .arrangement(params.id)
      .then((a) => {
        if (!cancelled) setArrangement(a);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [adapters, params.id]);

  const track = arrangement?.tracks[0];
  // Sequential distinct groupIds, in the same order WaitMatcher.expect() saw
  // them (notes are already tick-sorted) — this is what lets a numeric
  // matcherState.groupIndex be turned back into the groupId to highlight.
  // Uses activeNotes (the section-scoped list once playing) so it stays in
  // sync with what the matcher actually expects, not the whole track.
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

  async function handleSelectMidi(inputId: string): Promise<void> {
    if (!arrangement || !track) return;
    await selectMidiInput(inputId);
    await startArrangement(arrangement, track.id, crypto.randomUUID(), new Date().toISOString(), sectionId);
  }

  if (loadError) return <main><p>Could not load this piece: {loadError}</p></main>;
  if (!arrangement || !track) return <main><p>Loading…</p></main>;

  return (
    <main>
      <h1>{arrangement.id}</h1>

      {attemptStatus === 'idle' && (
        <section>
          <p>Choose your piano:</p>
          <ul>
            {midiInputs.map((input) => (
              <li key={input.id}>
                <button onClick={() => void handleSelectMidi(input.id)}>{input.name}</button>
              </li>
            ))}
          </ul>
          <p>Connection: {midiConnectionState}</p>
        </section>
      )}

      {attemptStatus === 'playing' && clock && (
        <FallingNotesCanvas
          clock={clock}
          notes={notesForDisplay}
          keyboardRange={profile.keyboardRange}
          pendingGroupId={pendingGroupId}
        />
      )}

      {attemptStatus === 'complete' && grade && (
        <section>
          <p>{'⭐'.repeat(grade.stars) || 'Try this one again!'}</p>
        </section>
      )}
    </main>
  );
}
