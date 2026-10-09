// TA-APP-003 `/studio/free-play` — track 2, Free play (FR-STU-018). For sitting down at the
// piano to unwind: no goals, no grading. "Make me a song" (FR-STU-020) writes a few minutes
// of music for both hands from the chosen feeling; "Play something for me" picks an easy
// progression and a rhythm to loop; the chord library is one tap away. The three are tiles
// like the Studio home; a settings card opens only for the tile chosen, so each step is one
// decision.

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
import { ActionCard, ActionGrid } from '../../../ui/shared/ActionCard';

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
  const [choice, setChoice] = useState<'song' | 'chords' | undefined>();
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

      <ActionGrid>
        <ActionCard
          variant="tile"
          onSelect={() => setChoice('song')}
          selected={choice === 'song'}
          shape="circle"
          shapeColour="tomato"
          corner="tl"
          colour="mustard"
          title={t('Make me a song')}
          description={t('Minutes of music, both hands.')}
        />
        <ActionCard
          variant="tile"
          onSelect={() => setChoice('chords')}
          selected={choice === 'chords'}
          shape="square"
          shapeColour="cornflower"
          corner="br"
          colour="peach"
          title={t('Just the chords')}
          description={t('A few chords in a rhythm.')}
        />
        <ActionCard
          variant="tile"
          href="/studio/chords"
          shape="arch"
          shapeColour="mustard"
          corner="tr"
          colour="cornflower"
          title={t('Chord library')}
          description={t('Browse every chord, or type your own.')}
        />
      </ActionGrid>

      {choice === undefined && <p>{t('Pick one to start.')}</p>}

      {choice !== undefined && (
        <Card tint={choice === 'song' ? 'mustard' : 'peach'}>
          <h2>{choice === 'song' ? t('Make me a song') : t('Just the chords')}</h2>
          <p>
            {choice === 'song'
              ? t('A few minutes of music written for you from easy chords: an intro, verses and choruses, a bridge and an ending. The left hand plays a bass line, the right hand a simple tune. Pick a feeling and a key if you like.')
              : t('Loop a few easy chords on their own, in a rhythm. Pick a feeling and a key if you like.')}
          </p>
          <Segmented
            name="mood"
            legend={t('How do you feel?')}
            value={mood}
            onChange={setMood}
            options={[{ value: ANY, label: t('Surprise me') }, ...moods.map((m) => ({ value: m, label: t(m) }))]}
          />
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('Key')}</span>
            <select value={keyChoice} onChange={(e) => chooseKey(e.target.value)}>
              <option value={ANY}>{t('Any key')}</option>
              {KEY_NAMES.map((name, i) => (
                <option key={name} value={String(i)}>{name}</option>
              ))}
            </select>
          </label>
          {choice === 'song' && (
            <>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <Segmented
                  name="length"
                  legend={t('How long?')}
                  value={length}
                  onChange={setLength}
                  options={[
                    { value: 'short' as const, label: t('Short · about 1 min') },
                    { value: 'song' as const, label: t('Medium · 2–3 min') },
                    { value: 'long' as const, label: t('Long · 3–4 min') },
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
              <div style={{ marginTop: '1.25rem' }}>
                <Button accent="indigo" onClick={makeSong}>
                  {t('Make me a song')}
                </Button>
              </div>
            </>
          )}
          {choice === 'chords' && (
            <>
              <div style={{ marginTop: '0.75rem' }}>
                <Button accent="indigo" onClick={suggest}>
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
            </>
          )}
        </Card>
      )}
    </PageShell>
  );
}
