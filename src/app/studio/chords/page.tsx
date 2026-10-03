// TA-APP-003 `/studio/chords` — US-3.13, the chord & progression explorer
// (FR-STU-012). Pick a key, browse its diatonic chords and a large
// catalogue of progressions (ported from free-midi-chords — see
// chordCatalogue.ts), play along with each chord validated by ChordMatcher
// and highlighted on an on-screen keybed. No timing requirement, no failure
// state — FR-EXP-006's free-play philosophy applied to harmony.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useChordExplorerStore } from '../../../runtime/stores/chordExplorerStore';
import { diatonicChordIds } from '../../../core/content/chordCatalogue';
import { GROUP_LABELS, GROUP_OF_QUALITY, type ChordGroup } from '../../../core/content/chordQualities';
import { chordSymbolOfId } from '../../../core/content/chordSymbols';
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
  const addUserProgression = useChordExplorerStore((s) => s.addUserProgression);
  const removeUserProgression = useChordExplorerStore((s) => s.removeUserProgression);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);
  const refreshMidiInputs = useChordExplorerStore((s) => s.refreshMidiInputs);
  const selectMidiInput = useChordExplorerStore((s) => s.selectMidiInput);
  const setKey = useChordExplorerStore((s) => s.setKey);
  const playChord = useChordExplorerStore((s) => s.playChord);
  const startProgression = useChordExplorerStore((s) => s.startProgression);
  const advanceProgression = useChordExplorerStore((s) => s.advanceProgression);

  const [modeFilter, setModeFilter] = useState<'all' | 'major' | 'minor' | 'modal'>('all');
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');
  const [newMode, setNewMode] = useState<'major' | 'minor'>('major');
  const [addError, setAddError] = useState<string | undefined>();
  const [justAdded, setJustAdded] = useState<string | undefined>();

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  const progressionsInKey = useMemo(
    () => (catalogue ? catalogue.progressions.filter((p) => p.key === selectedKey && !p.isUserAdded) : []),
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

  const chordsByGroup = useMemo(() => {
    const groups: Record<ChordGroup, { id: string; symbol: string }[]> = { triad: [], seventh: [], other: [] };
    if (!catalogue) return groups;
    for (const chord of catalogue.chords) {
      if (chord.root !== selectedKey) continue;
      groups[GROUP_OF_QUALITY[chord.quality] ?? 'other'].push({ id: chord.id, symbol: chordSymbolOfId(chord.id) });
    }
    return groups;
  }, [catalogue, selectedKey]);

  if (!catalogue) return <PageShell><p>Loading…</p></PageShell>;

  const myProgressions = catalogue.progressions.filter((p) => p.isUserAdded);

  async function handleAdd(): Promise<void> {
    const error = await addUserProgression({ name: newName, text: newText, key: selectedKey, mode: newMode });
    setAddError(error);
    if (error === undefined) {
      setJustAdded(newName.trim() || newText.trim());
      setNewName('');
      setNewText('');
    }
  }

  const diatonicIds = diatonicChordIds(selectedKey);
  const diatonicChords = diatonicIds.map((id) => catalogue.chords.find((c) => c.id === id)).filter((c) => c !== undefined);
  const currentChord = currentChordId ? catalogue.chords.find((c) => c.id === currentChordId) : undefined;
  const currentProgression = selectedProgressionId
    ? catalogue.progressions.find((p) => p.id === selectedProgressionId)
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
        <p>
          <strong>Add your own progression</strong>
        </p>
        <p style={{ opacity: 0.75 }}>
          Type chords from a chart — <code>C G Am F</code>, <code>Dm7 G7 Cmaj7</code>, <code>Bb/D</code> — or numerals in
          the key chosen above, like <code>I V vi IV</code>. In a minor key the numerals follow the natural minor scale
          (VII is G in A minor).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            aria-label="Name (optional)"
            placeholder="Name (optional)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: '0.5rem', font: 'inherit' }}
          />
          <textarea
            aria-label="Chords"
            placeholder="C G Am F"
            rows={2}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            style={{ padding: '0.5rem', font: 'inherit' }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
            <span>Numerals in {NOTE_NAMES[selectedKey as number]}:</span>
            {(['major', 'minor'] as const).map((mode) => (
              <Button
                key={mode}
                accent="coral"
                variant={newMode === mode ? 'primary' : 'secondary'}
                onClick={() => setNewMode(mode)}
              >
                {mode === 'major' ? 'Major' : 'Minor'}
              </Button>
            ))}
            <Button accent="indigo" onClick={() => void handleAdd()}>
              Add to my library
            </Button>
          </div>
          {addError && <p role="alert">{addError}</p>}
          {justAdded && !addError && <p role="status">Added “{justAdded}” to My progressions below.</p>}
        </div>
      </Card>

      <Card>
        <p>My progressions ({myProgressions.length}):</p>
        {myProgressions.length === 0 && <p style={{ opacity: 0.75 }}>Nothing yet — add one above.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {myProgressions.map((progression) => (
            <div key={progression.id} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <Button
                accent="indigo"
                variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
                onClick={() => startProgression(progression.id)}
              >
                {progression.name}
              </Button>
              <Link href={`/studio/chords/play/${encodeURIComponent(progression.id)}`}>
                <Button accent="coral" variant="secondary">Falling notes</Button>
              </Link>
              <Button
                accent="coral"
                variant="secondary"
                aria-label={`Remove ${progression.name}`}
                onClick={() => void removeUserProgression(progression.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
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
        <p>
          Chord library — every chord on {NOTE_NAMES[selectedKey as number]} ({Object.values(chordsByGroup).reduce((n, g) => n + g.length, 0)}):
        </p>
        {(['triad', 'seventh', 'other'] as const).map((group) => (
          <div key={group} style={{ marginBottom: '0.75rem' }}>
            <p style={{ opacity: 0.75, margin: '0 0 0.3rem' }}>
              {GROUP_LABELS[group]} ({chordsByGroup[group].length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {chordsByGroup[group].map((chord) => (
                <Button
                  key={chord.id}
                  accent="indigo"
                  variant={currentChordId === chord.id && !selectedProgressionId ? 'primary' : 'secondary'}
                  onClick={() => playChord(chord.id)}
                >
                  {chord.symbol}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </Card>

      <Card>
        <p>Progressions ({progressions.length} of {progressionsInKey.length}):</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {(['all', 'major', 'minor', 'modal'] as const).map((mode) => (
            <Button
              key={mode}
              accent="coral"
              variant={modeFilter === mode ? 'primary' : 'secondary'}
              onClick={() => setModeFilter(mode)}
            >
              {mode === 'all' ? 'All' : mode === 'major' ? 'Major' : mode === 'minor' ? 'Minor' : 'Modal'}
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
            </Button>{' '}
            <Link href={`/studio/chords/play/${encodeURIComponent(currentProgression.id)}`}>
              <Button accent="coral" variant="secondary">Play with falling notes</Button>
            </Link>
            {currentProgression.moods.length > 0 && (
              <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>({currentProgression.moods.join(', ')})</span>
            )}
          </p>
        )}
      </Card>

      {currentChord && (
        <Card>
          <p>
            Play: <strong>{chordSymbolOfId(currentChord.id)}</strong>
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
