// TA-APP-003 `/studio/chords` — US-3.13, the chord & progression explorer
// (FR-STU-012). Pick a key, browse its diatonic chords and a large
// catalogue of progressions (ported from free-midi-chords — see
// chordCatalogue.ts), play along with each chord validated by ChordMatcher
// and highlighted on an on-screen keybed. No timing requirement, no failure
// state — FR-EXP-006's free-play philosophy applied to harmony.
// US-3.20: three tabs (Chords, Progressions, My progressions), a compact top
// bar and a "now playing" keybed pinned to the top, so one screen holds one job.
// US-3.21 — the last inline styles moved to chords.module.css: a piano status
// pill, a framed now-playing card, card headings, chord groups, and your own
// progressions drawn as the same rows as the catalogue.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useChordExplorerStore } from '../../../runtime/stores/chordExplorerStore';
import { diatonicChordIds } from '../../../core/content/chordCatalogue';
import { GROUP_LABELS, GROUP_OF_QUALITY, type ChordGroup } from '../../../core/content/chordQualities';
import { chordSymbolOfId } from '../../../core/content/chordSymbols';
import { asPitchClass } from '../../../core/content/chordTypes';
import { useT } from '../../../ui/i18n/useT';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { ChordKeybed } from '../../../ui/shared/ChordKeybed';
import { Segmented } from '../../../ui/shared/Segmented';
import { Pill } from '../../../ui/shared/Pill';
import { EmptyState } from '../../../ui/shared/EmptyState';
import styles from './chords.module.css';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PAGE_SIZE = 12;

type Tab = 'chords' | 'progressions' | 'mine';

export default function ChordExplorerPage() {
  const t = useT();
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

  if (!catalogue) return <PageShell><StatusNote /></PageShell>;

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
    { id: 'chords', label: t('Chords'), count: chordCount },
    { id: 'progressions', label: t('Progressions'), count: progressionsInKey.length },
    { id: 'mine', label: t('My progressions'), count: myProgressions.length },
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
    <PageShell back={{ href: '/studio/free-play', label: t('Free play') }}>
      <div className={styles.top}>
        <h1>{t('Chords')}</h1>
        <div className={styles.row}>
          <span role="status">
            <Pill tone={isPianoConnected ? 'solid' : 'neutral'}>
              {isPianoConnected
                ? t('✓ Piano connected')
                : midiInputs.length > 0
                  ? t('Piano found, tap it to connect')
                  : t('No piano found')}
            </Pill>
          </span>
          {midiInputs.map((input) => (
            <Button key={input.id} accent="indigo" variant="secondary" onClick={() => void selectMidiInput(input.id)}>
              {input.name}
            </Button>
          ))}
        </div>
      </div>

      <Card tint="cornflower">
        <Segmented
          name="key"
          legend={t('Key')}
          options={NOTE_NAMES.map((name, i) => ({ value: i, label: name }))}
          value={selectedKey as number}
          onChange={(i) => setKey(asPitchClass(i))}
        />
      </Card>

      {currentChord && (
        <div className={styles.now}>
          <div className={styles.nowHead}>
            <div className={styles.nowText}>
              <span className={styles.sub}>
                {currentProgression
                  ? `${t(currentProgression.name)} · ${t('chord {n} of {total}', { n: currentChordIndex + 1, total: currentProgression.chordIds.length })}`
                  : t('Play this chord')}
              </span>
              <strong className={styles.nowChord}>{chordSymbolOfId(currentChord.id)}</strong>
            </div>
            {matchResult?.kind === 'complete' && (
              <span role="status">
                <Pill tone="solid">{t('✓ Nice!')}</Pill>
              </span>
            )}
          </div>
            <ChordKeybed
              target={currentChord.midiNotes.map((p) => asPitchClass(p as number))}
              played={playedPitchClasses}
            />
            {currentProgression && (
              <div className={styles.row}>
                <Button accent="indigo" variant="secondary" onClick={advanceProgression}>
                  {t('Next chord')}
                </Button>
                <Link href={`/studio/chords/play/${encodeURIComponent(currentProgression.id)}`}>
                  <Button accent="indigo" variant="secondary">{t('Play with falling notes')}</Button>
                </Link>
              </div>
            )}
        </div>
      )}

      <div role="tablist" aria-label={t('Chord explorer sections')} className={styles.tabs}>
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            id={`tab-${tb.id}`}
            aria-selected={tab === tb.id}
            aria-controls={`panel-${tb.id}`}
            className={styles.tab}
            onClick={() => setTab(tb.id)}
          >
            {tab === tb.id ? '✓ ' : ''}
            {tb.label}
            <span className={styles.count}>{tb.count}</span>
          </button>
        ))}
      </div>

      {tab === 'chords' && (
        <div role="tabpanel" id="panel-chords" aria-labelledby="tab-chords" className={styles.column}>
          <Card>
            <h2 className={styles.cardTitle}>{t('Chords that belong in {key}', { key: keyName ?? '' })}</h2>
            <p className={styles.sub}>{t('Press one to see it on the keys, then play it.')}</p>
            <div className={styles.row}>{diatonicChords.map((chord) => chordButton(chord.id, chordSymbolOfId(chord.id)))}</div>
          </Card>
          <Card>
            <h2 className={styles.cardTitle}>{t('All {count} chords on {key}', { count: chordCount, key: keyName ?? '' })}</h2>
            {(['triad', 'seventh', 'other'] as const).map((group) => (
              <details key={group} open={group === 'triad'} className={styles.group}>
                <summary className={styles.summary}>
                  {t(GROUP_LABELS[group])}
                  <span className={styles.count}>{chordsByGroup[group].length}</span>
                </summary>
                <div className={styles.row}>{chordsByGroup[group].map((chord) => chordButton(chord.id, chord.symbol))}</div>
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
                legend={t('Mode')}
                options={[
                  { value: 'all' as const, label: t('All') },
                  { value: 'major' as const, label: t('Major') },
                  { value: 'minor' as const, label: t('Minor') },
                  { value: 'modal' as const, label: t('Modal') },
                ]}
                value={modeFilter}
                onChange={(mode) => {
                  setModeFilter(mode);
                  setShownCount(PAGE_SIZE);
                }}
              />
              <label className={styles.mood}>
                {t('Mood')}
                <select
                  value={moodFilter ?? ''}
                  onChange={(e) => {
                    setMoodFilter(e.target.value === '' ? null : e.target.value);
                    setShownCount(PAGE_SIZE);
                  }}
                >
                  <option value="">{t('Any mood')}</option>
                  {availableMoods.map((mood) => (
                    <option key={mood} value={mood}>{t(mood)}</option>
                  ))}
                </select>
                <span className={styles.sub}>
                  {t('{count} progressions in {key}', { count: progressions.length, key: keyName ?? '' })}
                </span>
              </label>
            </div>
            <div>
              {progressions.slice(0, shownCount).map((progression) => (
                <div key={progression.id} className={styles.progRow}>
                  <div className={styles.rowText}>
                    <div className={styles.symbols}>{progression.chordIds.map(chordSymbolOfId).join('  ')}</div>
                    <div className={styles.sub}>
                      {t(progression.name)}
                      {progression.moods.length > 0 && ` · ${progression.moods.map((m) => t(m)).join(', ')}`}
                    </div>
                  </div>
                  <div className={styles.row}>
                    <Button
                      accent="indigo"
                      variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
                      aria-pressed={selectedProgressionId === progression.id}
                      onClick={() => startProgression(progression.id)}
                    >
                      {t('Play')}
                    </Button>
                    <Link href={`/studio/chords/play/${encodeURIComponent(progression.id)}`}>
                      <Button accent="indigo" variant="secondary">{t('Falling notes')}</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {progressions.length > shownCount && (
              <p>
                <Button accent="indigo" variant="secondary" onClick={() => setShownCount((n) => n + PAGE_SIZE)}>
                  {t('Show {count} more', { count: Math.min(PAGE_SIZE, progressions.length - shownCount) })}
                </Button>
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'mine' && (
        <div role="tabpanel" id="panel-mine" aria-labelledby="tab-mine" className={styles.column}>
          <Card>
            <h2 className={styles.cardTitle}>{t('Add your own progression')}</h2>
            <p className={styles.sub}>
              {t('Type chords from a chart, like')} <code>C G Am F</code>, <code>Dm7 G7 Cmaj7</code>, <code>Bb/D</code> — {t('or numerals in the key chosen above, like')} <code>I V vi IV</code>.{' '}
              {t('In a minor key the numerals follow the natural minor scale (VII is G in A minor).')}
            </p>
            <div className={styles.form}>
              <input
                aria-label={t('Name (optional)')}
                placeholder={t('Name (optional)')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <textarea
                aria-label={t('Chords')}
                placeholder="C G Am F"
                rows={2}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
              />
              <Segmented
                name="numeralMode"
                legend={t('Numerals in {key}', { key: keyName ?? '' })}
                options={[
                  { value: 'major' as const, label: t('Major') },
                  { value: 'minor' as const, label: t('Minor') },
                ]}
                value={newMode}
                onChange={setNewMode}
              />
              <div>
                <Button accent="indigo" onClick={() => void handleAdd()}>
                  {t('Add to my library')}
                </Button>
              </div>
              {addError && <p role="alert">{t(addError)}</p>}
              {justAdded && !addError && <p role="status">{t('Added “{title}” to the list below.', { title: justAdded })}</p>}
            </div>
          </Card>
          <Card>
            <h2 className={styles.cardTitle}>
              {t('My progressions')} <span className={styles.count}>{myProgressions.length}</span>
            </h2>
            {myProgressions.length === 0 && <EmptyState title={t('Nothing yet')}>{t('Add a progression above and it will wait here.')}</EmptyState>}
            <div>
              {myProgressions.map((progression) => (
                <div key={progression.id} className={styles.progRow}>
                  <div className={styles.rowText}>
                    <div className={styles.symbols}>{progression.chordIds.map(chordSymbolOfId).join('  ')}</div>
                    <div className={styles.sub}>{t(progression.name)}</div>
                  </div>
                  <div className={styles.row}>
                    <Button
                      accent="indigo"
                      variant={selectedProgressionId === progression.id ? 'primary' : 'secondary'}
                      aria-pressed={selectedProgressionId === progression.id}
                      onClick={() => startProgression(progression.id)}
                    >
                      {t('Play')}
                    </Button>
                    <Link href={`/studio/chords/play/${encodeURIComponent(progression.id)}`}>
                      <Button accent="indigo" variant="secondary">{t('Falling notes')}</Button>
                    </Link>
                    <Button
                      accent="indigo"
                      variant="secondary"
                      aria-label={t('Remove {name}', { name: progression.name })}
                      onClick={() => void removeUserProgression(progression.id)}
                    >
                      {t('Remove')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
