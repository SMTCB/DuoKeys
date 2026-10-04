// TA-APP-003 `/studio/songs` — track 3, Songs (FR-STU-017). "My songs" holds everything
// the adult is learning: library pieces they added and songs they brought in themselves
// (a pasted chord chart, a MIDI file or a MusicXML file). Adding a song saves it to the
// profile's settings record, so it is here the next time and on the other device.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../../runtime/bootstrap';
import type { ContentIndex } from '../../../adapters/ports';
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
import { Segmented } from '../../../ui/shared/Segmented';
import { LibraryControl } from '../../../ui/studio/LibraryControl';
import css from '../../../ui/shared/ListRow.module.css';

type AddWay = 'chart' | 'file';

const KIND_LABEL: Record<CustomSongKind, string> = { chart: 'Chord chart', midi: 'MIDI file', musicxml: 'MusicXML' };
const field = { font: 'inherit', padding: '0.7rem 0.9rem', minHeight: '44px', width: '100%', boxSizing: 'border-box' } as const;

function AddSong({ onAdded }: { onAdded: (title: string) => void }) {
  const add = useCustomSongStore((s) => s.add);
  const [way, setWay] = useState<AddWay>('chart');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [chart, setChart] = useState('');
  const [problem, setProblem] = useState<string | undefined>();

  const preview = useMemo(() => (way === 'chart' ? parseChordChart(chart) : undefined), [way, chart]);

  async function saveChart(): Promise<void> {
    const r = await add({ title, artist, kind: 'chart', data: chart });
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    setChart('');
    onAdded(r.song.title);
    setTitle('');
    setArtist('');
  }

  async function saveFile(file: File | undefined): Promise<void> {
    if (!file) return;
    if (file.size > MAX_CUSTOM_BYTES) return setProblem('That file is too big (the limit is 400 KB).');
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const isMidi = /\.(mid|midi)$/i.test(file.name);
    if (!isXml && !isMidi) return setProblem('Choose a .mid, .midi, .musicxml or .xml file.');
    const kind: CustomSongKind = isXml ? 'musicxml' : 'midi';
    const data = isXml ? await file.text() : bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    const name = title.trim() || file.name.replace(/\.[^.]+$/, '');
    const r = await add({ title: name, artist, kind, data });
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    onAdded(r.song.title);
    setTitle('');
    setArtist('');
  }

  return (
    <Card>
      <h2>Add a song</h2>
      <p>
        Want to learn something that is not in the library? Bring your own chords or file. It is saved to My songs on this
        profile. DuoKeys does not fetch songs for you — copy the chords from a chart you like.
      </p>
      <Segmented
        name="add-way"
        legend="How do you have it?"
        value={way}
        onChange={setWay}
        options={[
          { value: 'chart', label: 'Paste chords' },
          { value: 'file', label: 'Import a file' },
        ]}
      />
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
        Song name
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wonderwall" style={field} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
        Artist (optional)
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Oasis" style={field} />
      </label>

      {way === 'chart' ? (
        <>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
            Chords from the chart
            <textarea
              value={chart}
              onChange={(e) => setChart(e.target.value)}
              rows={9}
              placeholder={'[Verse]\nEm7  G  Dsus4  A7sus4\n\n[Chorus]\nC  D  Em'}
              style={{ ...field, fontFamily: 'var(--mono, monospace)' }}
            />
          </label>
          <p role="status" style={{ marginTop: '0.5rem' }}>
            {chart.trim() === ''
              ? 'Paste the chord lines. Lyrics are fine — they are skipped.'
              : preview && preview.chordIds.length > 0
                ? `Found ${preview.chordIds.length} chords${preview.sections.length > 0 ? ` in ${preview.sections.length} sections` : ''}.${
                    preview.unsupported.length > 0 ? ` Could not read: ${[...new Set(preview.unsupported)].join(', ')}.` : ''
                  }`
                : 'No chords found yet.'}
          </p>
          <div style={{ marginTop: '0.5rem' }}>
            <Button accent="indigo" onClick={() => void saveChart()} disabled={!title.trim() || !preview || preview.chordIds.length === 0}>
              Save to My songs
            </Button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: '0.75rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            MIDI or MusicXML file
            <input
              type="file"
              accept=".mid,.midi,.musicxml,.xml"
              onChange={(e) => {
                void saveFile(e.target.files?.[0]);
                e.target.value = '';
              }}
              style={field}
            />
          </label>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Notes become falling notes you can play along with. Leave the name empty to use the file name. Most scores export
            MusicXML from MuseScore; one instrument part at a time.
          </p>
        </div>
      )}
      {problem && <p role="alert">{problem}</p>}
    </Card>
  );
}

export default function SongsHubPage() {
  const [index, setIndex] = useState<ContentIndex | undefined>();
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

  return (
    <PageShell>
      <h1>Songs</h1>
      <p>
        Pick up where you are learning. <Link href="/studio">Back to Studio</Link>
      </p>

      <section aria-label="My songs" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2>My songs ({total})</h2>
        {justAdded && <p role="status">✓ “{justAdded}” is saved in My songs.</p>}
        {total === 0 && <p>Nothing here yet. Add a song below, or find one in the <Link href="/studio/library">song library</Link>.</p>}
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

      <AddSong onAdded={setJustAdded} />

      <Card>
        <h2>Find in the library</h2>
        <p>570+ piano and harpsichord pieces, free to play and share.</p>
        <Link href="/studio/library"><Button accent="indigo" variant="secondary">Open the song library</Button></Link>
      </Card>

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
    </PageShell>
  );
}
