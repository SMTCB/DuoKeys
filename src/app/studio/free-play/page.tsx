// TA-APP-003 `/studio/free-play` — track 2, Free play (FR-STU-018). For sitting down at the
// piano to unwind: no goals, no grading. "Make me a song" (FR-STU-020) writes a few minutes
// of music for both hands from the chosen feeling; "Play something for me" picks an easy
// progression and a rhythm to loop; the chord library is one tap away.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { freePlaySongHref, type SongLength, type SongLevel } from '../../../core/content/freePlaySong';
import { useChordExplorerStore } from '../../../runtime/stores/chordExplorerStore';
import { CHORD_STYLES } from '../../../core/content/styledProgression';
import { chordSymbolOfId } from '../../../core/content/chordSymbols';
import { easyMoods, pickFreePlay, sameProgressionInKey, type FreePlaySuggestion } from '../../../core/content/freePlay';
import { asPitchClass } from '../../../core/content/chordTypes';
import { useT } from '../../../ui/i18n/useT';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { Pill } from '../../../ui/shared/Pill';
import { Segmented } from '../../../ui/shared/Segmented';
import { ActionCard } from '../../../ui/shared/ActionCard';

const ANY = '';
const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export default function FreePlayPage() {
  const t = useT();
  const catalogue = useChordExplorerStore((s) => s.catalogue);
  const loadCatalogue = useChordExplorerStore((s) => s.loadCatalogue);
  const [mood, setMood] = useState<string>(ANY);
  const [suggestion, setSuggestion] = useState<FreePlaySuggestion | undefined>();
  // '' lets the suggestion pick its own key; a number fixes the key.
  const [keyChoice, setKeyChoice] = useState<string>(ANY);
  const [length, setLength] = useState<SongLength>('song');
  const [level, setLevel] = useState<SongLevel>(1);
  const router = useRouter();

  useEffect(() => {
    void loadCatalogue();
  }, [loadCatalogue]);

  const moods = useMemo(() => (catalogue ? easyMoods(catalogue.progressions).slice(0, 6) : []), [catalogue]);

  if (!catalogue) return <PageShell><StatusNote /></PageShell>;

  function suggest(): void {
    if (!catalogue) return;
    setSuggestion(
      pickFreePlay(catalogue.progressions, { ...(mood !== ANY ? { mood } : {}), ...(keyChoice !== ANY ? { key: asPitchClass(Number(keyChoice)) } : {}), ...(suggestion ? { avoidId: suggestion.progression.id } : {}) }, Math.random),
    );
  }

  function makeSong(): void {
    router.push(
      freePlaySongHref({
        seed: Math.floor(Math.random() * 1_000_000_000) + 1,
        length,
        level,
        ...(mood !== ANY ? { mood } : {}),
        ...(keyChoice !== ANY ? { key: asPitchClass(Number(keyChoice)) } : {}),
      }),
    );
  }

  // Choosing a key after a suggestion moves that same progression there, so the mood stays.
  function chooseKey(value: string): void {
    setKeyChoice(value);
    if (!suggestion || !catalogue || value === ANY) return;
    const moved = sameProgressionInKey(catalogue.progressions, suggestion.progression, asPitchClass(Number(value)));
    if (moved) setSuggestion({ ...suggestion, progression: moved });
  }

  const styleLabel = suggestion
    ? suggestion.style === 'block'
      ? t('Block chords')
      : (CHORD_STYLES.find((s) => s.id === suggestion.style)?.label ?? suggestion.style)
    : '';
  const shownStyle = t(styleLabel);
  const isMoodMissed = suggestion !== undefined && mood !== ANY && !suggestion.progression.moods.includes(mood);
  const keyLabel = suggestion
    ? `${KEY_NAMES[suggestion.progression.key as number]}${suggestion.progression.mode === 'minor' ? ` ${t('minor')}` : ''}`
    : '';
  const playHref = suggestion
    ? `/studio/chords/play/${encodeURIComponent(suggestion.progression.id)}${suggestion.style === 'block' ? '' : `?style=${suggestion.style}`}`
    : '';

  return (
    <PageShell>
      <h1>{t('Free play')}</h1>
      <p>
        {t('Sit down, relax, make something that sounds like music. Nothing is graded and nothing runs out.')}{' '}
        <Link href="/studio">{t('Back to Studio')}</Link>
      </p>

      <Card>
        <h2>{t('Make me a song')}</h2>
        <p>
          {t('A few minutes of music written for you from easy chords: an intro, verses and choruses, a bridge and an ending. The left hand plays a bass line, the right hand a simple tune. Pick a feeling and a key if you like.')}
        </p>
        <Segmented
          name="mood"
          legend={t('How do you feel?')}
          value={mood}
          onChange={setMood}
          options={[{ value: ANY, label: t('Surprise me') }, ...moods.map((m) => ({ value: m, label: t(m) }))]}
        />
        <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem' }}>
          {t('Key')}
          <select value={keyChoice} onChange={(e) => chooseKey(e.target.value)}>
            <option value={ANY}>{t('Any key')}</option>
            {KEY_NAMES.map((name, i) => (
              <option key={name} value={String(i)}>{name}</option>
            ))}
          </select>
        </label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <Segmented
            name="length"
            legend={t('How long?')}
            value={length}
            onChange={setLength}
            options={[
              { value: 'short' as const, label: t('Short') },
              { value: 'song' as const, label: t('A song') },
              { value: 'long' as const, label: t('Long') },
            ]}
          />
          <Segmented
            name="level"
            legend={t('How busy?')}
            value={level}
            onChange={setLevel}
            options={[
              { value: 1 as const, label: t('Simple') },
              { value: 2 as const, label: t('Fuller') },
            ]}
          />
        </div>
        <div style={{ marginTop: '0.75rem' }}>
          <Button accent="indigo" onClick={makeSong}>
            {t('Make me a song')}
          </Button>
        </div>
      </Card>

      <Card>
        <h2>{t('Just the chords')}</h2>
        <p>
          {t('Or loop a few easy chords on their own, in a rhythm, using the feeling and key above. Each suggestion uses only a few easy chords.')}
        </p>
        <div style={{ marginTop: '0.75rem' }}>
          <Button accent="indigo" variant="secondary" onClick={suggest}>
            {suggestion ? t('Another one') : t('Play something for me')}
          </Button>
        </div>
        {suggestion && (
          <div role="status" style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('Your chords, in the key of {key}', { key: keyLabel })}
            </span>
            <strong style={{ fontFamily: 'var(--display)', fontSize: '1.25rem' }}>
              {suggestion.progression.chordIds.map(chordSymbolOfId).join('  ')}
            </strong>
            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{t('Feels:')}</span>
              {suggestion.progression.moods.map((m) => (
                <Pill key={m} tone={m === mood ? 'solid' : 'neutral'}>{t(m)}</Pill>
              ))}
            </span>
            {isMoodMissed && (
              <p style={{ margin: 0 }}>
                {t('No easy {mood} chords in {key}, so this one feels different. Pick another key or tap “Another one”.', { mood: t(mood).toLowerCase(), key: keyLabel })}
              </p>
            )}
            <span style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span>{t('Rhythm:')}</span>
              <Pill>{shownStyle}</Pill>
            </span>
            <p style={{ margin: 0 }}>
              {t('The rhythm is the pattern the chords are played in, all at once (block chords) or as a groove. It is picked at random; you can change it on the next screen. Play the chords with one hand or both. They fall and wait for you, so there is no hurry.')}
            </p>
            <div>
              <Link href={playHref}>
                <Button accent="indigo">{t('Play it')}</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>

      <ActionCard href="/studio/chords" icon="♯" title={t('Chord library')} description={t('Pick a key, browse its chords and 100+ progressions, or type your own.')} />
    </PageShell>
  );
}
