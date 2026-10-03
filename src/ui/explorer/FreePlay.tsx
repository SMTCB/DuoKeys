// TA-APP-003 `/explorer/free-play` — US-2.19. No grading, no matcher, no
// Attempt written (FR-EXP-006 is explicitly ungraded): every noteOn above
// VELOCITY_FLOOR just sounds and shows the note name, cleared on noteOff.
// Component-local state, no store — this component is also mounted directly
// by the session-arc route (US-2.17) for its warm-up/wind-down steps, and a
// dedicated store would only add indirection neither caller needs.

'use client';

import { useEffect, useState } from 'react';
import { getAdapters } from '../../runtime/bootstrap';
import type { MidiInputInfo, MidiConnectionState, VoiceHandle } from '../../adapters/ports';
import { MidiDecoder, type MidiPitch } from '../../core/midi/decode';
import { VELOCITY_FLOOR } from '../../core/match/types';
import { midiPitchToNoteName } from '../../core/content/noteName';
import { MidiChooser } from '../shared/MidiChooser';
import { Card } from '../shared/Card';
import stage from '../shared/Stage.module.css';

export function FreePlay() {
  const [midiInputs, setMidiInputs] = useState<MidiInputInfo[]>([]);
  const [connectionState, setConnectionState] = useState<MidiConnectionState>('disconnected');
  const [connected, setConnected] = useState(false);
  const [lastPitch, setLastPitch] = useState<MidiPitch | undefined>();

  useEffect(() => {
    void getAdapters().midi.listInputs().then(setMidiInputs);
  }, []);

  async function handleSelectMidi(inputId: string): Promise<void> {
    const adapters = getAdapters();
    await adapters.audio.resume(); // user-gesture unlock, TA-AUD-003
    await adapters.midi.open(inputId);
    adapters.midi.onStateChange(setConnectionState);

    const decoder = new MidiDecoder();
    const voices = new Map<MidiPitch, VoiceHandle>();

    adapters.midi.onMessage((msg) => {
      const event = decoder.decode(msg.data, msg.timeStamp);
      if (!event) return;

      if (event.kind === 'noteOn' && event.velocity >= VELOCITY_FLOOR) {
        const handle = adapters.audio.playNote(event.pitch, event.velocity);
        voices.set(event.pitch, handle);
        setLastPitch(event.pitch);
      } else if (event.kind === 'noteOff') {
        const handle = voices.get(event.pitch);
        if (handle) {
          adapters.audio.stopNote(handle);
          voices.delete(event.pitch);
        }
        setLastPitch((current) => (current === event.pitch ? undefined : current));
      }
    });

    setConnected(true);
  }

  if (!connected) {
    return (
      <Card>
        <MidiChooser
          inputs={midiInputs}
          connectionState={connectionState}
          onSelect={(id) => void handleSelectMidi(id)}
        />
      </Card>
    );
  }

  return (
    <section className={stage.stage}>
      <p className={stage.title}>Play anything!</p>
      <div className={stage.bigNote}>{lastPitch !== undefined ? midiPitchToNoteName(lastPitch) : '🎹'}</div>
    </section>
  );
}
