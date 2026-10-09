// TA-APP-003 `/explorer/ninja` — Note Ninja (US-2.13). A note is shown, the
// child plays it, and the response-time band (TA-GRD-005) decides the
// feedback. No countdown, no losing (FR-EXP-003): a wrong key just reveals
// the hint immediately, same as the 6s timeout would, and the card waits.

'use client';

import { useEffect, useState } from 'react';
import { useNoteNinjaStore } from '../../../runtime/stores/noteNinjaStore';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { useNoteName, useT } from '../../../ui/i18n/useT';
import { getAdapters } from '../../../runtime/bootstrap';
import { NoteKeys } from '../../../ui/shared/NoteKeys';
import { NoteStaff } from '../../../ui/shared/NoteStaff';
import { RewardBurst } from '../../../ui/shared/RewardBurst';
import { PageShell } from '../../../ui/shared/PageShell';
import { Card } from '../../../ui/shared/Card';
import { MidiChooser } from '../../../ui/shared/MidiChooser';
import { Pill } from '../../../ui/shared/Pill';
import stage from '../../../ui/shared/Stage.module.css';

const HINT_DELAY_MS = 6000;
const ADVANCE_DELAY_MS = 900;

export default function NoteNinjaPage() {
  const t = useT();
  const noteName = useNoteName();
  const profile = useSessionStore((s) => s.profile);
  const midiInputs = useNoteNinjaStore((s) => s.midiInputs);
  const midiConnectionState = useNoteNinjaStore((s) => s.midiConnectionState);
  const currentPitch = useNoteNinjaStore((s) => s.currentPitch);
  const hintShown = useNoteNinjaStore((s) => s.hintShown);
  const lastResult = useNoteNinjaStore((s) => s.lastResult);
  const streak = useNoteNinjaStore((s) => s.streak);
  const setNinjaProfile = useNoteNinjaStore((s) => s.setProfile);
  const refreshMidiInputs = useNoteNinjaStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useNoteNinjaStore((s) => s.selectMidiInput);
  const startSession = useNoteNinjaStore((s) => s.startSession);
  const nextCard = useNoteNinjaStore((s) => s.nextCard);
  const revealHint = useNoteNinjaStore((s) => s.revealHint);

  const [started, setStarted] = useState(false);

  // sessionStore.profile is the single source of truth for "who's playing"
  // (US-2.01); noteNinjaStore keeps its own non-reactive reference, so it
  // needs an explicit bridge rather than reading sessionStore directly.
  useEffect(() => {
    setNinjaProfile(profile);
  }, [profile, setNinjaProfile]);

  useEffect(() => {
    void refreshMidiInputs();
  }, [refreshMidiInputs]);

  // The 6s "no losing, just a hint" timeout (FR-EXP-005) — a wall-clock timer
  // kept in the component, not the store, and cancelled whenever the card
  // changes or is already answered.
  useEffect(() => {
    if (!started || currentPitch === undefined || hintShown || lastResult) return;
    const timer = setTimeout(() => revealHint(), HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [started, currentPitch, hintShown, lastResult, revealHint]);

  // Brief pause on a correct/hinted answer so the child sees the feedback,
  // then the next card is drawn.
  useEffect(() => {
    if (!lastResult) return;
    const timer = setTimeout(() => void nextCard(), ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [lastResult, nextCard]);

  // TA-AUD-001, NFR-011 — every accepted answer gets the same immediate
  // audio-visual reward, hinted or not (FR-EXP-003: no failure state).
  useEffect(() => {
    if (!lastResult) return;
    getAdapters().audio.playSample('star-earned');
  }, [lastResult]);

  async function handleSelectMidi(inputId: string): Promise<void> {
    await selectMidiInput(inputId);
    await startSession();
    setStarted(true);
  }

  return (
    <PageShell>
      <h1>{t('Note Ninja')}</h1>

      {!started && (
        <Card>
          <MidiChooser
            inputs={midiInputs}
            connectionState={midiConnectionState}
            onSelect={(id) => void handleSelectMidi(id)}
          />
        </Card>
      )}

      {started && currentPitch !== undefined && (
        <div className={stage.stage}>
          <Pill mono>{t('Streak {streak}', { streak })}</Pill>
          <div className={stage.bigNote}>{noteName(currentPitch)}</div>
          <div className={stage.noteViews}>
            <NoteKeys pitches={[currentPitch]} />
            <NoteStaff pitches={[currentPitch]} />
          </div>
          {lastResult && <RewardBurst />}
          {lastResult?.band === 'fast' && <span className={stage.bandFast}>{t('Fast!')}</span>}
          {lastResult?.band === 'correct' && <span className={stage.bandCorrect}>{t('Nice!')}</span>}
          {lastResult?.band === 'hinted' && <span className={stage.bandHinted}>{t('Got it!')}</span>}
          {hintShown && !lastResult && (
            <p className={stage.hint}>{t("Hint: it's {note} — find it on the keyboard.", { note: noteName(currentPitch) })}</p>
          )}
        </div>
      )}
    </PageShell>
  );
}
