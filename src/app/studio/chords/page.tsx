// TA-APP-003 `/studio/chords` — US-3.13, the chord & progression explorer
// (FR-STU-012). Pick a key, browse its diatonic chords and a large
// catalogue of progressions (ported from free-midi-chords — see
// chordCatalogue.ts), play along with each chord validated by ChordMatcher
// and highlighted on an on-screen keybed. No timing requirement, no failure
// state — FR-EXP-006's free-play philosophy applied to harmony.
// US-3.20: three tabs (Chords, Progressions, My progressions), a compact top
// bar and a "now playing" keybed pinned to the top, so one screen holds one job.

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
import { Segmented } from '../../../ui/shared/Segmented';
import styles from './chords.module.css';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PAGE_SIZE = 12;
const ROW = { display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' } as const;
const COLUMN = { display: 'flex', flexDirection: 'column', gap: '1rem' } as const;

type Tab = 'chords' | 'progressions' | 'mine';

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

  const [tab, setTab] = useState<Tab>('chords');
  const [modeFilter, setModeFilter] = useState<'all' | 'major' | 'minor' | 'modal'>('all');
  const [moodFilter, setMoodFilter] = useState<string | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [newName, setNewName] = useState('');
  const [newText, setNewText] = useState('');
  const [newMode, setNewMode] = useState<'major' | 'minor'>('major');
  const [addError, setAddError] = useState<string | undefined>();
  const [justAdded, setJustAdded] = useState<string | undefined>();

  useEffect(() => {
    void loadCatalogue();
    void refreshMidiInputs();
  }, [loadCatalogue, refreshMidiInputs]);

  const progressionsInKey = useMemo(() => {
    if (!catalogue) return [];
    // The source lists some progressions more than once; show each chord sequence once.
    const seen = new Set<string>();
    return catalogue.progressions.filter((p) => {
      if (p.key !== selectedKey || p.isUserAdded) return false;
      const sequence = p.chordIds.join('>');
      if (seen.has(sequence)) return false;
      seen.add(sequence);
      return true;
    });
  }, [catalogue, selectedKey]);
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

  const keyName = NOTE_NAMES[selectedKey as number];
  const isPianoConnected = midiConnectionState === 'connected';
  const chordCount = Object.values(chordsByGroup).reduce((n, g) => n + g.length, 0);
  const diatonicChords = diatonicChordIds(selectedKey)
    .map((id) => catalogue.chords.find((c) => c.id === id))
    .filter((c) => c !== undefined);
  const currentChord = currentChordId ? catalogue.chords.find((c) => c.id === currentChordId) : undefined;
  const currentProgression = selectedProgressionId
    ? catalogue.progressions.find((p) => p.id === selectedProgressionId)
    : undefined;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'chords', label: 'Chords', count: chordCount },
    { id: 'progressions', label: 'Progressions', count: progressionsInKey.length },
    { id: 'mine', label: 'My progressions', count: myProgressions.length },
  ];

  const chordButton = (id: string, label: string) => (
    <Button
      key={id}
      accent="indigo"
      variant={currentChordId === id && !selectedProgressionId ? 'primary' : 'secondary'}
      aria-pressed={currentChordId === id && !selectedProgressionId}
      onClick={() => playChord(id)}
    >
      {label}
    </Button>
  );

  return (
    <PageShell>
      <div style={{ ...ROW, justifyContent: 'space-between' }}>
        <h1 style={{ margin: 0 }}>Chords</h1>
        <div style={ROW}>
          <span role="status">Piano: {isPianoConnected ? 'connected' : 'not connected'}</span>
          {midiInputs.map((input) => (
            <Button key={input.id} accent="indigo" variant="secondary" onClick={() => void selectMidiInput(input.id)}>
              {input.name}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <Segmented
          name="key"
          legend="Key"
          options={NOTE_NAMES.map((name, i) => ({ value: i, label: name }))}
          value={selectedKey as number}
          onChange={(i) => setKey(asPitchClass(i))}
        />
      </Card>

      {currentChord && (
        <div style={{ position: 'sticky', top: 0, zIndex: 5 }}>
          <Card>
            <p style={{ margin: '0 0 0.4rem' }}>
              {currentProgression
                ? `${currentProgression.name} — chord ${currentChordIndex + 1} of ${currentProgression.chordIds.length}: `
                : 'Play: '}
              <strong>{chordSymbolOfId(currentChord.id)}</strong>
              {matchResult?.kind === 'complete' && ' — nice!'}
            </p>
            <ChordKeybed
              target={currentChord.midiNotes.map((p) => asPitchClass(p as number))}
              played={playedPitchClasses}
            />
            {currentProgression && (
              <div style={{ ...ROW, marginTop: '0.5rem' }}>
                <Button accent="indigo" variant="secondary" onClick={advanceProgression}>
                  Next chord
                </Button>
                <Link href={`/studio/chords/play/${encodeURIComponent(currentProgression.id)}`}>
                  <Button accent="indigo" variant="secondary">Play with falling notes</Button>
                </Link>
              </div>
            )}
          </Card>
        </div>
      )}

      <div role="tablist" aria-label="Chord explorer sections" className={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={styles.tab}
            onClick={() => setTab(t.id)}
          >
            {tab === t.id ? '✓ ' : ''}
            {t.label}
            <span className={styles.count}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'chords' && (
        <div role="tabpanel" id="panel-chords" aria-labelledby="tab-chords" style={COLUMN}>
          <Card>
            <p style={{ marginTop: 0 }}>
              <strong>Chords that belong in {keyName}</strong> — press one to see it on the keys, then play it.
            </p>
            <div style={ROW}>{diatonicChords.map((chord) => chordButton(chord.id, chordSymbolOfId(chord.id)))}</div>
          </Card>
          <Card>
            <p style={{ marginTop: 0 }}>
              <strong>All {chordCount} chords on {keyName}</strong>
            </p>
            {(['triad', 'seventh', 'other'] as const).map((group) => (
              <details key={group} open={group === 'triad'} style={{ marginBottom: '0.5rem' }}>
                <summary style={{ minHeight: '44px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  {GROUP_LABELS[group]} ({chordsByGroup[group].length})
                </summary>
                <div style={ROW}>{chordsByGroup[group].map((chord) => chordButton(chord.id, chord.symbol))}</div>
              </details>
            ))}
          </Card>
        </div>
      )}

      {tab === 'progressions' && (
        <div role="tabpanel" id="panel-progressions" aria-labelledby="tab-progressions">
          <Card>
            <div className={styles.filters}>
              <Segmented
                name="modeFilter"
                legend="Mode"
                options={[
                  { value: 'all' as const, label: 'All' },
                  { value: 'major' as const, label: 'Major' },
                  { value: 'minor' as const, label: 'Minor' },
                  { value: 'modal' as const, label: 'Modal' },
                ]}
                value={modeFilter}
                onChange={(mode) => {
                  setModeFilter(mode);
                  setShownCount(PAGE_SIZE);
                }}
              />
              <label className={styles.mood}>
                Mood
                <select
                  value={moodFilter ?? ''}
                  onChange={(e) => {
                    setMoodFilter(e.target.value === '' ? null : e.target.value);
                    setShownCount(PAGE_SIZE);
                  }}
                >
                  <option value="">Any mood</option>
                  {availableMoods.map((mood) => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
                <span className={styles.sub}>
                  {progressions.length} progressions in {keyName}
                </span>
              </label>
            </div>
            <div>
              {progressions.slice(0, shownCount).map((progression) => (
                <div key={progression.id} className={styles.progRow}>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.symbols}>{progression.chordIds.map(chordSymbolOfId).join('  ')}</div>
                    <div className={styles.sub}>
                      {progression.name}
                      {progression.moods.length > 0 && ` · ${progression.moods.join(', ')}`}
                    </div>
                  </div>
                  <div style={ROW}>
                    <Button
                      accent="indigo"
                      variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
                      aria-pressed={selectedProgressionId === progression.id}
                      onClick={() => startProgression(progression.id)}
                    >
                      Play
                    </Button>
                    <Link href={`/studio/chords/play/${encodeURIComponent(progression.id)}`}>
                      <Button accent="indigo" variant="secondary">Falling notes</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {progressions.length > shownCount && (
              <p>
                <Button accent="indigo" variant="secondary" onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, progressions.length - shownCount)} more
                </Button>
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'mine' && (
        <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" style={COLUMN}>
          <Card>
            <p style={{ marginTop: 0 }}>
              <strong>Add your own progression</strong>
            </p>
            <p style={{ opacity: 0.75 }}>
              Type chords from a chart — <code>C G Am F</code>, <code>Dm7 G7 Cmaj7</code>, <code>Bb/D</code> — or
              numerals in the key chosen above, like <code>I V vi IV</code>. In a minor key the numerals follow the
              natural minor scale (VII is G in A minor).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                aria-label="Name (optional)"
                placeholder="Name (optional)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <textarea
                aria-label="Chords"
                placeholder="C G Am F"
                rows={2}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <Segmented
                name="numeralMode"
                legend={`Numerals in ${keyName}`}
                options={[
                  { value: 'major' as const, label: 'Major' },
                  { value: 'minor' as const, label: 'Minor' },
                ]}
                value={newMode}
                onChange={setNewMode}
              />
              <div>
                <Button accent="indigo" onClick={() => void handleAdd()}>
                  Add to my library
                </Button>
              </div>
              {addError && <p role="alert">{addError}</p>}
              {justAdded && !addError && <p role="status">Added “{justAdded}” to the list below.</p>}
            </div>
          </Card>
          <Card>
            <p style={{ marginTop: 0 }}>My progressions ({myProgressions.length})</p>
            {myProgressions.length === 0 && <p style={{ opacity: 0.75 }}>Nothing yet — add one above.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {myProgressions.map((progression) => (
                <div key={progression.id} style={ROW}>
                  <Button
                    accent="indigo"
                    variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
                    onClick={() => startProgression(progression.id)}
                  >
                    {progression.name}
                  </Button>
                  <Link href={`/studio/chords/play/${encodeURIComponent(progression.id)}`}>
                    <Button accent="indigo" variant="secondary">Falling notes</Button>
                  </Link>
                  <Button
                    accent="indigo"
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
        </div>
      )}
    </PageShell>
  );
}
