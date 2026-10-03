// TA-APP-003 `/studio/library` — FR-STU-016, the song library. Search ~580 solo piano and
// harpsichord pieces from the Mutopia Project (public domain and Creative Commons), add
// the ones you want to "my songs", and play them as falling notes via /studio/play/[id].
// Every row carries its licence and a link to the piece's own page.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSongLibraryStore } from '../../../runtime/stores/songLibraryStore';
import { searchSongs, stylesOf, type SongEntry } from '../../../core/content/songLibrary';
import { PageShell } from '../../../ui/shared/PageShell';
import { Pill } from '../../../ui/shared/Pill';
import css from './library.module.css';
import { Button } from '../../../ui/shared/Button';

const MAX_SHOWN = 60;

function SongRow({ song, isSaved, onAdd, onRemove }: { song: SongEntry; isSaved: boolean; onAdd(): void; onRemove(): void }) {
  return (
    <li className={css.row}>
      <span className={css.tile} aria-hidden="true">
        {song.composer.trim().charAt(0).toUpperCase() || '♪'}
      </span>
      <div className={css.body}>
        <span className={css.title}>
          {song.title}
          {song.opus ? ` · ${song.opus}` : ''}
        </span>
        <span className={css.composer}>{song.composer}</span>
        <span className={css.meta}>
          {[song.style, song.instrument].filter(Boolean).map((t) => (
            <Pill key={t} tone="neutral">{t}</Pill>
          ))}
          <Pill tone="neutral" mono>{song.bars} bars</Pill>
          {isSaved && <Pill>✓ In my songs</Pill>}
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
          <Button accent="indigo">Play</Button>
        </Link>
        {isSaved ? (
          <Button accent="indigo" variant="secondary" onClick={onRemove}>
            Remove
          </Button>
        ) : (
          <Button accent="indigo" variant="secondary" onClick={onAdd}>
            Add to my songs
          </Button>
        )}
      </div>
    </li>
  );
}

export default function SongLibraryPage() {
  const songs = useSongLibraryStore((s) => s.songs);
  const loadError = useSongLibraryStore((s) => s.loadError);
  const savedSongIds = useSongLibraryStore((s) => s.savedSongIds);
  const load = useSongLibraryStore((s) => s.load);
  const addSong = useSongLibraryStore((s) => s.addSong);
  const removeSong = useSongLibraryStore((s) => s.removeSong);
  const [text, setText] = useState('');
  const [style, setStyle] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  const saved = useMemo(() => (songs ?? []).filter((s) => savedSongIds.includes(s.id)), [songs, savedSongIds]);
  const found = useMemo(() => searchSongs(songs ?? [], { text, style }), [songs, text, style]);
  const styles = useMemo(() => stylesOf(songs ?? []), [songs]);

  if (loadError) return <PageShell><p>Could not load the song library: {loadError}</p></PageShell>;
  if (!songs) return <PageShell><p>Loading…</p></PageShell>;

  return (
    <PageShell>
      <h1>Song library</h1>
      <p>
        {songs.length} piano and harpsichord pieces from the{' '}
        <a href="https://www.mutopiaproject.org" target="_blank" rel="noreferrer">Mutopia Project</a>. Add what you like to
        “my songs”, then play it as falling notes. <Link href="/studio">Back to Studio</Link>
      </p>

      {saved.length > 0 && (
        <section aria-label="My songs" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2>My songs ({saved.length})</h2>
          <ul className={css.list}>
          {saved.map((s) => (
            <SongRow key={s.id} song={s} isSaved onAdd={() => void addSong(s.id)} onRemove={() => void removeSong(s.id)} />
          ))}
          </ul>
        </section>
      )}

      <section aria-label="Find a song" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2>Find a song</h2>
        <div className={css.search}>
          <input
            type="search"
            aria-label="Search by title, composer or opus"
            placeholder="Title, composer or opus — e.g. chopin nocturne"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <select aria-label="Style" value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="">All styles</option>
            {styles.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <p role="status" className={css.status}>
          {found.length === 0
            ? 'Nothing matches — try fewer words.'
            : found.length > MAX_SHOWN
              ? `Showing the first ${MAX_SHOWN} of ${found.length} — type more to narrow it down.`
              : `${found.length} found.`}
        </p>
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
