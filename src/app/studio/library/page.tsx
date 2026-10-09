// TA-APP-003 `/studio/library` — FR-STU-016, the song library. Search ~580 solo piano and
// harpsichord pieces from the Mutopia Project (public domain and Creative Commons), add
// the ones you want to "my songs", and play them as falling notes via /studio/play/[id].
// Every row carries its licence and a link to the piece's own page.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSongLibraryStore } from '../../../runtime/stores/songLibraryStore';
import { SONG_LEVEL_LABEL, searchSongs, songLevel, stylesOf, type SongEntry, type SongLevel } from '../../../core/content/songLibrary';
import { translateInstrument } from '../../../core/i18n/songTitle';
import { useLocale, useT } from '../../../ui/i18n/useT';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Pill } from '../../../ui/shared/Pill';
import { EmptyState } from '../../../ui/shared/EmptyState';
import css from '../../../ui/shared/ListRow.module.css';
import { Button } from '../../../ui/shared/Button';

const MAX_SHOWN = 60;

function SongRow({ song, isSaved, onAdd, onRemove }: { song: SongEntry; isSaved: boolean; onAdd(): void; onRemove(): void }) {
  const t = useT();
  const locale = useLocale();
  return (
    <li className={css.row}>
      <span className={css.tile} aria-hidden="true">
        {song.composer.trim().charAt(0).toUpperCase() || '♪'}
      </span>
      <div className={css.body}>
        <span className={css.title}>
          {t(song.title)}
          {song.opus ? ` · ${song.opus}` : ''}
        </span>
        <span className={css.composer}>{song.composer}</span>
        <span className={css.meta}>
          {[song.style ? t(song.style) : '', song.instrument ? (locale === 'pt' ? translateInstrument(song.instrument) : song.instrument) : '']
            .filter(Boolean)
            .map((tag) => (
              <Pill key={tag} tone="neutral">{tag}</Pill>
            ))}
          <Pill tone="neutral">{t(SONG_LEVEL_LABEL[songLevel(song)])}</Pill>
          <Pill tone="neutral" mono>{t('{bars} bars', { bars: song.bars })}</Pill>
          {isSaved && <Pill>{t('✓ In my songs')}</Pill>}
        </span>
        <span className={css.links}>
          <a href={song.licenceUrl || song.sourceUrl} target="_blank" rel="noreferrer">
            {song.licenceLabel}
          </a>{' '}
          · <a href={song.sourceUrl} target="_blank" rel="noreferrer">Mutopia Project</a>
        </span>
      </div>
      <div className={css.actions}>
        <Link href={`/studio/play/${song.id}`}>
          <Button accent="indigo">{t('Play')}</Button>
        </Link>
        {isSaved ? (
          <Button accent="indigo" variant="secondary" onClick={onRemove}>
            {t('Remove')}
          </Button>
        ) : (
          <Button accent="indigo" variant="secondary" onClick={onAdd}>
            {t('Add to my songs')}
          </Button>
        )}
      </div>
    </li>
  );
}

export default function SongLibraryPage() {
  const t = useT();
  const songs = useSongLibraryStore((s) => s.songs);
  const loadError = useSongLibraryStore((s) => s.loadError);
  const savedSongIds = useSongLibraryStore((s) => s.savedSongIds);
  const load = useSongLibraryStore((s) => s.load);
  const addSong = useSongLibraryStore((s) => s.addSong);
  const removeSong = useSongLibraryStore((s) => s.removeSong);
  const [text, setText] = useState('');
  const [style, setStyle] = useState('');
  const [level, setLevel] = useState<SongLevel | undefined>();

  useEffect(() => {
    void load();
  }, [load]);

  const saved = useMemo(() => (songs ?? []).filter((s) => savedSongIds.includes(s.id)), [songs, savedSongIds]);
  const found = useMemo(() => searchSongs(songs ?? [], { text, style, ...(level === undefined ? {} : { level }) }), [songs, text, style, level]);
  const styles = useMemo(() => stylesOf(songs ?? []), [songs]);

  if (loadError) return <PageShell><StatusNote tone="problem">{t('Could not load the song library: {error}', { error: loadError })}</StatusNote></PageShell>;
  if (!songs) return <PageShell><StatusNote /></PageShell>;

  return (
    <PageShell>
      <h1>{t('Song library')}</h1>
      <p>
        {t('{count} piano and harpsichord pieces from the', { count: songs.length })}{' '}
        <a href="https://www.mutopiaproject.org" target="_blank" rel="noreferrer">Mutopia Project</a>.{' '}
        {t('Add what you like to “my songs”, then play it as falling notes.')} <Link href="/studio">{t('Back to Studio')}</Link>
      </p>

      {saved.length > 0 && (
        <section aria-label={t('My songs')} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2>{t('My songs')} ({saved.length})</h2>
          <ul className={css.list}>
          {saved.map((s) => (
            <SongRow key={s.id} song={s} isSaved onAdd={() => void addSong(s.id)} onRemove={() => void removeSong(s.id)} />
          ))}
          </ul>
        </section>
      )}

      <section aria-label={t('Find a song')} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2>{t('Find a song')}</h2>
        <div className={css.search}>
          <input
            type="search"
            aria-label={t('Search by title, composer or opus')}
            placeholder={t('Title, composer or opus — e.g. chopin nocturne')}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select aria-label={t('Style')} value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">{t('All styles')}</option>
            {styles.map((s) => (
              <option key={s} value={s}>{t(s)}</option>
            ))}
          </select>
          <select
            aria-label={t('Difficulty')}
            value={level ?? ''}
            onChange={(e) => setLevel(e.target.value === '' ? undefined : (Number(e.target.value) as SongLevel))}
          >
            <option value="">{t('All levels')}</option>
            {([1, 2, 3, 4, 5] as const).map((l) => (
              <option key={l} value={l}>{t(SONG_LEVEL_LABEL[l])}</option>
            ))}
          </select>
        </div>
        <p className={css.status}>{t('Level is estimated from how many notes each bar holds.')}</p>
        <p role="status" className={css.status}>
          {found.length === 0
            ? t('Nothing matches — try fewer words.')
            : found.length > MAX_SHOWN
              ? t('Showing the first {shown} of {total} — type more to narrow it down.', { shown: MAX_SHOWN, total: found.length })
              : t('{count} found.', { count: found.length })}
        </p>
        {found.length === 0 && <EmptyState title={t('No songs found')}>{t('Try a shorter search, or set the level back to All levels.')}</EmptyState>}
        <ul className={css.list}>
        {found.slice(0, MAX_SHOWN).map((s) => (
          <SongRow
            key={s.id}
            song={s}
            isSaved={savedSongIds.includes(s.id)}
            onAdd={() => void addSong(s.id)}
            onRemove={() => void removeSong(s.id)}
          />
        ))}
        </ul>
      </section>
    </PageShell>
  );
}
