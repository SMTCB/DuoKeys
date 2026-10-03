// TA-APP-003 `/studio/chords` — US-3.13, the chord & progression explorer
// (FR-STU-012). Pick a key, browse its diatonic chords and a large
// catalogue of progressions (ported from free-midi-chords — see
// chordCatalogue.ts), play along with each chord validated by ChordMatcher
// and highlighted on an on-screen keybed. No timing requirement, no failure
// state — FR-EXP-006's free-play philosophy applied to harmony.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useChordExplorerStore } from '../../../runtime/stores/chordExplorerStore';
import { diatonicChordIds } from '../../../core/content/chordCatalogue';
import { asPitchClass } from '../../../core/content/chordTypes';
import { PageShell } from '../../../ui/shared/PageShell';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { ChordKeybed } from '../../../ui/shared/ChordKeybed';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function ChordExplorerPage() {
  const catalogue = useChordExplorerStore((s) => s.catalogue);
  const midiInputs = useChordExplorerStore((s) => s.midiInputs);
  const midiConnectionState = useChordExplorerStore((s) => s.midiConnectionState);
  const selectedKey = useChordExplorerStore((s) => s.selectedKey);
  const selectedProgressionId = useChordExplorerStore((s) => s.selectedProgressionId);
  const currentChordIndex = useChordExplorerStore((s) => s.currentChordIndex);
  const currentChordId = useChordExplorerStore((s) => s.currentChordId);
  const matchResult = useChordExplorerStore((s) => s.matchResult);
  const playedPitchClasses = useChordExplorerStore((s) => s.playedPitchClasses);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);
  const refreshMidiInputs = useChordExplorerStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useChordExplorerStore((s) => s.selectMidiInput);
  const setKey = useChordExplorerStore((s) => s.setKey);
  const playChord = useChordExplorerStore((s) => s.playChord);
  const startProgression = useChordExplorerStore((s) => s.startProgression);
  const advanceProgression = useChordExplorerStore((s) => s.advanceProgression);

  const [modeFilter, setModeFilter] = useState<'all' | 'major' | 'minor'>('all');
  const [moodFilter, setMoodFilter] = useState<string | null>(null);

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  const progressionsInKey = useMemo(
    () => (catalogue ? catalogue.progressions.filter((p) => p.key === selectedKey) : []),
    [catalogue, selectedKey],
  );
  const availableMoods = useMemo(
    () => Array.from(new Set(progressionsInKey.flatMap((p) => p.moods))).sort(),
    [progressionsInKey],
  );
  const progressions = useMemo(
    () =>
      progressionsInKey.filter(
        (p) => (modeFilter === 'all' || p.mode === modeFilter) && (moodFilter === null || p.moods.includes(moodFilter)),
      ),
    [progressionsInKey, modeFilter, moodFilter],
  );

  if (!catalogue) return <PageShell><p>Loading…</p></PageShell>;

  const diatonicIds = diatonicChordIds(selectedKey);
  const diatonicChords = diatonicIds.map((id) => catalogue.chords.find((c) => c.id === id)).filter((c) => c !== undefined);
  const currentChord = currentChordId ? catalogue.chords.find((c) => c.id === currentChordId) : undefined;
  const currentProgression = selectedProgressionId
    ? progressionsInKey.find((p) => p.id === selectedProgressionId)
    : undefined;

  return (
    <PageShell>
      <h1>Chord & progression explorer</h1>

      <Card>
        <p>Key:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {NOTE_NAMES.map((name, i) => (
            <Button
              key={name}
              accent="indigo"
              variant={selectedKey === i ? 'primary' : 'secondary'}
              onClick={() => setKey(asPitchClass(i))}
            >
              {name}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <p>Choose your piano:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {midiInputs.map((input) => (
            <Button key={input.id} accent="indigo" onClick={() => void selectMidiInput(input.id)}>
              {input.name}
            </Button>
          ))}
        </div>
        <p>Connection: {midiConnectionState}</p>
      </Card>

      <Card>
        <p>Diatonic chords in {NOTE_NAMES[selectedKey as number]}:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {diatonicChords.map((chord) => (
            <Button
              key={chord.id}
              accent="indigo"
              variant={currentChordId === chord.id && !selectedProgressionId ? 'primary' : 'secondary'}
              onClick={() => playChord(chord.id)}
            >
              {chord.id}
            </Button>
          ))}
        </div>
      </Card>

      <Card>
        <p>Progressions ({progressions.length} of {progressionsInKey.length}):</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {(['all', 'major', 'minor'] as const).map((mode) => (
            <Button
              key={mode}
              accent="coral"
              variant={modeFilter === mode ? 'primary' : 'secondary'}
              onClick={() => setModeFilter(mode)}
            >
              {mode === 'all' ? 'All' : mode === 'major' ? 'Major' : 'Minor'}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <Button accent="coral" variant={moodFilter === null ? 'primary' : 'secondary'} onClick={() => setMoodFilter(null)}>
            Any mood
          </Button>
          {availableMoods.map((mood) => (
            <Button
              key={mood}
              accent="coral"
              variant={moodFilter === mood ? 'primary' : 'secondary'}
              onClick={() => setMoodFilter(mood)}
            >
              {mood}
            </Button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {progressions.map((progression) => (
            <Button
              key={progression.id}
              accent="indigo"
              variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
              onClick={() => startProgression(progression.id)}
            >
              {progression.name}
            </Button>
          ))}
        </div>
        {currentProgression && (
          <p style={{ marginTop: '0.75rem' }}>
            Chord {currentChordIndex + 1} of {currentProgression.chordIds.length}: {currentChordId}
            {' — '}
            <Button accent="indigo" variant="secondary" onClick={advanceProgression}>
              Next chord
            </Button>
            {currentProgression.moods.length > 0 && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>({currentProgression.moods.join(', ')})</span>
            )}
          </p>
        )}
      </Card>

      {currentChord && (
        <Card>
          <p>
            Play: <strong>{currentChord.id}</strong>
            {matchResult?.kind === 'complete' && ' — nice!'}
          </p>
          <ChordKeybed
            target={currentChord.midiNotes.map((p) => asPitchClass(p as number))}
            played={playedPitchClasses}
          />
        </Card>
      )}
    </PageShell>
  );
}
