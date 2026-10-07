// TA-APP-003 `/studio/songs` — track 3, Songs (FR-STU-017). Five ways in, as five tiles: the
// song library, paste a chord chart, upload a MIDI file, upload a score (MusicXML or
// compressed .mxl) and the starter pieces. "My songs" below holds everything the adult is
// learning. Adding a song saves it to the profile's settings record, so it is here the next
// time and on the other device.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../../runtime/bootstrap';
import type { ContentIndex } from '../../../adapters/ports';
import { mxlToMusicXml } from '../../../adapters/content/mxl';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { useLibraryStore } from '../../../runtime/stores/libraryStore';
import { useSongLibraryStore } from '../../../runtime/stores/songLibraryStore';
import { bytesToBase64, useCustomSongStore } from '../../../runtime/stores/customSongStore';
import { MAX_CUSTOM_BYTES, parseChordChart, type CustomSongKind } from '../../../core/content/customSong';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { Pill } from '../../../ui/shared/Pill';
import { LibraryControl } from '../../../ui/studio/LibraryControl';
import css from '../../../ui/shared/ListRow.module.css';
import options from '../../../ui/studio/SongOptions.module.css';

type OptionId = 'paste' | 'midi' | 'score' | 'starter';

const KIND_LABEL: Record<CustomSongKind, string> = { chart: 'Chord chart', midi: 'MIDI file', musicxml: 'Score' };
const field = { font: 'inherit', padding: '0.7rem 0.9rem', minHeight: '44px', width: '100%', boxSizing: 'border-box' } as const;
const labelStyle = { display: 'flex', flexDirection: 'column', gap: '0.4rem' } as const;

function NameFields({
  title,
  artist,
  setTitle,
  setArtist,
  placeholder,
}: {
  title: string;
  artist: string;
  setTitle(v: string): void;
  setArtist(v: string): void;
  placeholder?: string;
}) {
  return (
    <>
      <label style={labelStyle}>
        Song name
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder ?? 'Wonderwall'} style={field} />
      </label>
      <label style={labelStyle}>
        Artist (optional)
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Oasis" style={field} />
      </label>
    </>
  );
}

function PastePanel({ onAdded }: { onAdded: (title: string) => void }) {
  const add = useCustomSongStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [chart, setChart] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const preview = useMemo(() => parseChordChart(chart), [chart]);

  async function save(): Promise<void> {
    const r = await add({ title, artist, kind: 'chart', data: chart });
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    setChart('');
    setTitle('');
    setArtist('');
    onAdded(r.song.title);
  }

  return (
    <Card>
      <div className={options.panel}>
        <h2>Add a song by pasting its chords</h2>
        <p className={options.note}>Copy the chords from a chart you like. DuoKeys does not fetch songs for you.</p>
        <NameFields title={title} artist={artist} setTitle={setTitle} setArtist={setArtist} />
        <label style={labelStyle}>
          Chords from the chart
          <textarea
            value={chart}
            onChange={(e) => setChart(e.target.value)}
            rows={9}
            placeholder={'[Verse]\nEm7  G  Dsus4  A7sus4\n\n[Chorus]\nC  D  Em'}
            style={{ ...field, fontFamily: 'var(--mono, monospace)' }}
          />
        </label>
        <p role="status" className={options.note}>
          {chart.trim() === ''
            ? 'Paste the chord lines. Lyrics are fine, they are skipped.'
            : preview.chordIds.length > 0
              ? `Found ${preview.chordIds.length} chords${preview.sections.length > 0 ? ` in ${preview.sections.length} sections` : ''}.${
                  preview.unsupported.length > 0 ? ` Could not read: ${[...new Set(preview.unsupported)].join(', ')}.` : ''
                }`
              : 'No chords found yet.'}
        </p>
        <div>
          <Button accent="indigo" onClick={() => void save()} disabled={!title.trim() || preview.chordIds.length === 0}>
            Save to My songs
          </Button>
        </div>
        {problem && <p role="alert">{problem}</p>}
      </div>
    </Card>
  );
}

/** One panel for both file kinds: a MIDI file, or a score exported as MusicXML / compressed MusicXML. */
function FilePanel({ way, onAdded }: { way: 'midi' | 'score'; onAdded: (title: string) => void }) {
  const add = useCustomSongStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const isScore = way === 'score';

  async function save(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > MAX_CUSTOM_BYTES) return setProblem('That file is too big (the limit is 400 KB).');
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const isMxl = /\.mxl$/i.test(file.name);
    const isMidi = /\.(mid|midi)$/i.test(file.name);
    if (isScore ? !isXml && !isMxl : !isMidi) {
      return setProblem(
        isScore
          ? /\.(pdf|png|jpe?g|heic|gif)$/i.test(file.name)
            ? 'A PDF or a photo of a score cannot be read yet. Export it as MusicXML from a notation program (see below).'
            : 'Choose a .musicxml, .xml or .mxl file.'
          : 'Choose a .mid or .midi file.',
      );
    }
    let data: string;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      data = isMidi ? bytesToBase64(bytes) : isMxl ? await mxlToMusicXml(bytes) : await file.text();
    } catch (e) {
      return setProblem(e instanceof Error ? e.message : 'That file could not be read.');
    }
    if (!isMidi && data.length > MAX_CUSTOM_BYTES) return setProblem('That score is too big once unzipped (the limit is 400 KB).');
    const r = await add({ title: title.trim() || file.name.replace(/\.[^.]+$/, ''), artist, kind: isMidi ? 'midi' : 'musicxml', data });
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    setTitle('');
    setArtist('');
    onAdded(r.song.title);
  }

  return (
    <Card>
      <div className={options.panel}>
        <h2>{isScore ? 'Add a song from a score' : 'Add a song from a MIDI file'}</h2>
        <p className={options.note}>
          {isScore
            ? 'Upload the score as a MusicXML file. DuoKeys turns its notes into falling notes you can play.'
            : 'Upload a MIDI file. Its notes become falling notes you can play.'}{' '}
          Leave the name empty to use the file name.
        </p>
        <NameFields title={title} artist={artist} setTitle={setTitle} setArtist={setArtist} placeholder="Leave empty to use the file name" />
        <label style={labelStyle}>
          {isScore ? 'Score file (.musicxml, .xml or .mxl)' : 'MIDI file (.mid or .midi)'}
          <input
            type="file"
            accept={isScore ? '.musicxml,.xml,.mxl' : '.mid,.midi'}
            onChange={(e) => {
              void save(e.target.files?.[0]);
              e.target.value = '';
            }}
            style={field}
          />
        </label>
        {isScore && (
          <p className={options.note}>
            Have a PDF or a photo of the page? It cannot be read directly, because reading printed music from an image needs a
            separate tool. Open it in MuseScore (or a scanning tool such as Audiveris), save it as MusicXML, then upload that
            here. One piano part at a time works best.
          </p>
        )}
        {problem && <p role="alert">{problem}</p>}
      </div>
    </Card>
  );
}

const TILES: { id: OptionId | 'library'; icon: string; name: string; hint: string }[] = [
  { id: 'library', icon: '📚', name: 'Song library', hint: '570+ piano pieces to search' },
  { id: 'paste', icon: '📋', name: 'Paste chords', hint: 'From a chord chart you like' },
  { id: 'midi', icon: '🎹', name: 'Upload MIDI', hint: 'A .mid or .midi file' },
  { id: 'score', icon: '🎼', name: 'Upload a score', hint: 'MusicXML (.musicxml, .mxl)' },
  { id: 'starter', icon: '⭐', name: 'Starter pieces', hint: 'Short pieces to begin with' },
];

export default function SongsHubPage() {
  const [index, setIndex] = useState<ContentIndex | undefined>();
  const [open, setOpen] = useState<OptionId | undefined>();
  const [justAdded, setJustAdded] = useState<string | undefined>();
  const profile = useSessionStore((s) => s.profile);
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const customSongs = useCustomSongStore((s) => s.songs);
  const loadCustom = useCustomSongStore((s) => s.load);
  const removeCustom = useCustomSongStore((s) => s.remove);
  const librarySongs = useSongLibraryStore((s) => s.songs);
  const savedSongIds = useSongLibraryStore((s) => s.savedSongIds);
  const loadSongs = useSongLibraryStore((s) => s.load);
  const removeSong = useSongLibraryStore((s) => s.removeSong);

  useEffect(() => {
    let cancelled = false;
    getAdapters().content.index().then((i) => {
      if (!cancelled) setIndex(i);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadLibrary(profile.id);
    void loadCustom();
    void loadSongs();
  }, [profile.id, loadLibrary, loadCustom, loadSongs]);

  const savedLibrary = useMemo(() => (librarySongs ?? []).filter((s) => savedSongIds.includes(s.id)), [librarySongs, savedSongIds]);
  const total = customSongs.length + savedLibrary.length;

  if (!index) return <PageShell><StatusNote /></PageShell>;

  function added(title: string): void {
    setJustAdded(title);
    setOpen(undefined);
  }

  return (
    <PageShell>
      <h1>Songs</h1>
      <p>
        Choose how to get a song. <Link href="/studio">Back to Studio</Link>
      </p>

      <ul className={options.tiles} aria-label="Ways to add a song">
        {TILES.map((t) => {
          const optionId = t.id === 'library' ? undefined : t.id;
          return (
          <li key={t.id}>
            {optionId === undefined ? (
              <Link href="/studio/library" className={options.tile}>
                <span className={options.icon} aria-hidden="true">{t.icon}</span>
                <span className={options.name}>{t.name}</span>
                <span className={options.hint}>{t.hint}</span>
              </Link>
            ) : (
              <button
                type="button"
                className={options.tile}
                aria-expanded={open === optionId}
                onClick={() => setOpen((cur) => (cur === optionId ? undefined : optionId))}
              >
                <span className={options.icon} aria-hidden="true">{t.icon}</span>
                <span className={options.name}>{t.name}</span>
                <span className={options.hint}>{t.hint}</span>
              </button>
            )}
          </li>
          );
        })}
      </ul>

      {open === 'paste' && <PastePanel onAdded={added} />}
      {open === 'midi' && <FilePanel way="midi" onAdded={added} />}
      {open === 'score' && <FilePanel way="score" onAdded={added} />}
      {open === 'starter' && (
        <section aria-label="Starter pieces" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <h2>Starter pieces</h2>
          <ul className={css.list}>
            {index.pieces.map((piece) => (
              <li key={piece.id} className={css.row}>
                <span className={css.tile} aria-hidden="true">♪</span>
                <div className={css.body}>
                  <Link className={css.title} href={`/studio/play/${piece.defaultArrangementId}`}>{piece.title}</Link>
                </div>
                <LibraryControl profileId={profile.id} arrangementId={piece.defaultArrangementId} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="My songs" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2>My songs ({total})</h2>
        {justAdded && <p role="status">✓ “{justAdded}” is saved in My songs.</p>}
        {total === 0 && <p>Nothing here yet. Pick one of the options above.</p>}
        <ul className={css.list}>
          {customSongs.map((s) => (
            <li key={s.id} className={css.row}>
              <span className={css.tile} aria-hidden="true">{s.title.trim().charAt(0).toUpperCase() || '♪'}</span>
              <div className={css.body}>
                <Link className={css.title} href={`/studio/play/${encodeURIComponent(s.id)}`}>{s.title}</Link>
                {s.artist && <span className={css.composer}>{s.artist}</span>}
                <span className={css.meta}><Pill tone="neutral">{KIND_LABEL[s.kind]}</Pill><Pill>Mine</Pill></span>
              </div>
              <div className={css.actions}>
                <Link href={`/studio/play/${encodeURIComponent(s.id)}`}><Button accent="indigo">Play</Button></Link>
                <Button accent="indigo" variant="secondary" onClick={() => void removeCustom(s.id)}>Remove</Button>
              </div>
              <LibraryControl profileId={profile.id} arrangementId={s.id} />
            </li>
          ))}
          {savedLibrary.map((s) => (
            <li key={s.id} className={css.row}>
              <span className={css.tile} aria-hidden="true">{s.composer.trim().charAt(0).toUpperCase() || '♪'}</span>
              <div className={css.body}>
                <Link className={css.title} href={`/studio/play/${s.id}`}>{s.title}{s.opus ? ` · ${s.opus}` : ''}</Link>
                <span className={css.composer}>{s.composer}</span>
                <span className={css.meta}><Pill tone="neutral">Library</Pill></span>
              </div>
              <div className={css.actions}>
                <Link href={`/studio/play/${s.id}`}><Button accent="indigo">Play</Button></Link>
                <Button accent="indigo" variant="secondary" onClick={() => void removeSong(s.id)}>Remove</Button>
              </div>
              <LibraryControl profileId={profile.id} arrangementId={s.id} />
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
