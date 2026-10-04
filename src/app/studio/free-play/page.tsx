// TA-APP-003 `/studio/free-play` — track 2, Free play (FR-STU-018). For sitting down at the
// piano to unwind: no goals, no grading. "Play something for me" picks an easy progression
// and a rhythm so there is nothing to decide; the chord library is one tap away.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useChordExplorerStore } from '../../../runtime/stores/chordExplorerStore';
import { CHORD_STYLES } from '../../../core/content/styledProgression';
import { chordSymbolOfId } from '../../../core/content/chordSymbols';
import { easyMoods, pickFreePlay, type FreePlaySuggestion } from '../../../core/content/freePlay';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { Pill } from '../../../ui/shared/Pill';
import { Segmented } from '../../../ui/shared/Segmented';
import { ActionCard } from '../../../ui/shared/ActionCard';

const ANY = '';

export default function FreePlayPage() {
  const catalogue = useChordExplorerStore((s) => s.catalogue);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);
  const [mood, setMood] = useState<string>(ANY);
  const [suggestion, setSuggestion] = useState<FreePlaySuggestion | undefined>();

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const moods = useMemo(() => (catalogue ? easyMoods(catalogue.progressions).slice(0, 6) : []), [catalogue]);

  if (!catalogue) return <PageShell><StatusNote /></PageShell>;

  function suggest(): void {
    if (!catalogue) return;
    setSuggestion(
      pickFreePlay(catalogue.progressions, { ...(mood !== ANY ? { mood } : {}), ...(suggestion ? { avoidId: suggestion.progression.id } : {}) }, Math.random),
    );
  }

  const styleLabel = suggestion
    ? suggestion.style === 'block'
      ? 'Block chords'
      : (CHORD_STYLES.find((s) => s.id === suggestion.style)?.label ?? suggestion.style)
    : '';
  const playHref = suggestion
    ? `/studio/chords/play/${encodeURIComponent(suggestion.progression.id)}${suggestion.style === 'block' ? '' : `?style=${suggestion.style}`}`
    : '';

  return (
    <PageShell>
      <h1>Free play</h1>
      <p>
        Sit down, relax, make something that sounds like music. Nothing is graded and nothing runs out.{' '}
        <Link href="/studio">Back to Studio</Link>
      </p>

      <Card>
        <h2>Play something for me</h2>
        <p>Pick a feeling if you like. Each suggestion uses only a few easy chords, and a rhythm to play them in.</p>
        <Segmented
          name="mood"
          legend="How do you feel?"
          value={mood}
          onChange={setMood}
          options={[{ value: ANY, label: 'Surprise me' }, ...moods.map((m) => ({ value: m, label: m }))]}
        />
        <div style={{ marginTop: '0.75rem' }}>
          <Button accent="indigo" onClick={suggest}>
            {suggestion ? 'Another one' : 'Play something for me'}
          </Button>
        </div>
        {suggestion && (
          <div role="status" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
              {suggestion.progression.chordIds.map(chordSymbolOfId).join('  ')}
            </strong>
            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <Pill>{styleLabel}</Pill>
              {suggestion.progression.moods.map((m) => (
                <Pill key={m} tone="neutral">{m}</Pill>
              ))}
              <Pill tone="neutral">{suggestion.distinctChordCount} chords</Pill>
            </span>
            <p style={{ margin: 0 }}>
              Play the chords with one hand or both. They fall and wait for you, so there is no hurry.
            </p>
            <div>
              <Link href={playHref}>
                <Button accent="indigo">Play it</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>

      <ActionCard href="/studio/chords" icon="♯" title="Chord library" description="Pick a key, browse its chords and 100+ progressions, or type your own." />
    </PageShell>
  );
}
