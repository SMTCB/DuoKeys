// TA-APP-003 `/studio/songs` — track 3, Songs (FR-STU-017). Five ways in, as five tiles: the
// song library, paste a chord chart, upload a MIDI file, upload a score (MusicXML or
// compressed .mxl, or a PDF / picture read by the optional local score reader) and the starter pieces. "My songs" below holds everything the adult is
// learning. Adding a song saves it to the profile's settings record, so it is here the next
// time and on the other device.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getAdapters } from '../../../runtime/bootstrap';
import type { ContentIndex } from '../../../adapters/ports';
import { mxlToMusicXml } from '../../../adapters/content/mxl';
import { scanScore } from '../../../adapters/content/omrClient';
import { useSessionStore } from '../../../runtime/stores/sessionStore';
import { useLibraryStore } from '../../../runtime/stores/libraryStore';
import { useSongLibraryStore } from '../../../runtime/stores/songLibraryStore';
import { bytesToBase64, useCustomSongStore } from '../../../runtime/stores/customSongStore';
import { MAX_CUSTOM_BYTES, parseChordChart, type CustomSongKind } from '../../../core/content/customSong';
import { parseMusicXmlWithReport, withTempo } from '../../../core/content/parseMusicXml';
import { useT } from '../../../ui/i18n/useT';
import { PageShell } from '../../../ui/shared/PageShell';
import { StatusNote } from '../../../ui/shared/StatusNote';
import { Card } from '../../../ui/shared/Card';
import { Button } from '../../../ui/shared/Button';
import { Pill } from '../../../ui/shared/Pill';
import { EmptyState } from '../../../ui/shared/EmptyState';
import type { PopColour, PopShapeName } from '../../../ui/shared/PopShape';
import { ActionCard, ActionGrid, type PopCorner } from '../../../ui/shared/ActionCard';
import { LibraryControl } from '../../../ui/studio/LibraryControl';
import { ScanReview, type ScanSummary } from '../../../ui/studio/ScanReview';
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
  const t = useT();
  return (
    <>
      <label style={labelStyle}>
        {t('Song name')}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder ?? 'Wonderwall'} style={field} />
      </label>
      <label style={labelStyle}>
        {t('Artist (optional)')}
        <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Oasis" style={field} />
      </label>
    </>
  );
}

type Tint = 'mustard' | 'peach' | 'cornflower';

function PastePanel({ onAdded, tint }: { onAdded: (title: string) => void; tint: Tint }) {
  const t = useT();
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
    <Card tint={tint}>
      <div className={options.panel}>
        <h2>{t('Add a song by pasting its chords')}</h2>
        <p className={options.note}>{t('Copy the chords from a chart you like. DuoKeys does not fetch songs for you.')}</p>
        <NameFields title={title} artist={artist} setTitle={setTitle} setArtist={setArtist} />
        <label style={labelStyle}>
          {t('Chords from the chart')}
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
            ? t('Paste the chord lines. Lyrics are fine, they are skipped.')
            : preview.chordIds.length > 0
              ? `${preview.sections.length > 0 ? t('Found {count} chords in {sections} sections.', { count: preview.chordIds.length, sections: preview.sections.length }) : t('Found {count} chords.', { count: preview.chordIds.length })}${
                  preview.unsupported.length > 0 ? ` ${t('Could not read: {list}.', { list: [...new Set(preview.unsupported)].join(', ') })}` : ''
                }`
              : t('No chords found yet.')}
        </p>
        <div>
          <Button accent="indigo" onClick={() => void save()} disabled={!title.trim() || preview.chordIds.length === 0}>
            {t('Save to My songs')}
          </Button>
        </div>
        {problem && <p role="alert">{t(problem)}</p>}
      </div>
    </Card>
  );
}

/** One panel for both file kinds: a MIDI file, or a score exported as MusicXML / compressed MusicXML. */
function FilePanel({ way, onAdded, tint }: { way: 'midi' | 'score'; onAdded: (title: string) => void; tint: Tint }) {
  const t = useT();
  const add = useCustomSongStore((s) => s.add);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  const [scan, setScan] = useState<{ xml: string; name: string; summary: ScanSummary } | undefined>();
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [needsReader, setNeedsReader] = useState(false);
  const isScore = way === 'score';

  // ADR-010: a PDF or picture goes to the score reader on this computer, then to a check screen.
  async function readScan(file: File): Promise<void> {
    setProblem(undefined);
    setNeedsReader(false);
    setScan(undefined);
    setIsReading(true);
    const result = await scanScore(file);
    setIsReading(false);
    if (!result.ok) {
      if (result.reason === 'unavailable') setNeedsReader(true);
      else setProblem(result.message);
      return;
    }
    try {
      const { source, report } = parseMusicXmlWithReport(result.musicXml, { id: 'scan' });
      const noteCount = source.tracks.reduce((sum, tr) => sum + tr.notes.filter((n) => !n.rest).length, 0);
      setScan({
        xml: result.musicXml,
        name: file.name,
        summary: { ...report, noteCount, tempoBpm: source.tempoBpm },
      });
    } catch (e) {
      setProblem(t('The scan could not be turned into a song: {reason}', { reason: e instanceof Error ? t(e.message) : t('unreadable') }));
    }
  }

  async function saveScan(tempoBpm: number | undefined): Promise<void> {
    if (!scan) return;
    const data = tempoBpm === undefined ? scan.xml : withTempo(scan.xml, tempoBpm);
    if (data.length > MAX_CUSTOM_BYTES) return setProblem(t('That score is too big (the limit is 400 KB).'));
    setIsSaving(true);
    const r = await add({ title: title.trim() || scan.name.replace(/\.[^.]+$/, ''), artist, kind: 'musicxml', data });
    setIsSaving(false);
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    setScan(undefined);
    setTitle('');
    setArtist('');
    onAdded(r.song.title);
  }

  async function save(file: File | undefined): Promise<void> {
    if (!file) return;
    if (isScore && /\.(pdf|png|jpe?g)$/i.test(file.name)) return readScan(file);
    if (file.size > MAX_CUSTOM_BYTES) return setProblem(t('That file is too big (the limit is 400 KB).'));
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const isMxl = /\.mxl$/i.test(file.name);
    const isMidi = /\.(mid|midi)$/i.test(file.name);
    if (isScore ? !isXml && !isMxl : !isMidi) {
      return setProblem(
        isScore
          ? /\.(heic|gif)$/i.test(file.name)
            ? t('Save the picture as a PNG or JPG first.')
            : t('Choose a .musicxml, .xml, .mxl, .pdf, .png or .jpg file.')
          : t('Choose a .mid or .midi file.'),
      );
    }
    let data: string;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      data = isMidi ? bytesToBase64(bytes) : isMxl ? await mxlToMusicXml(bytes) : await file.text();
    } catch (e) {
      return setProblem(e instanceof Error ? e.message : t('That file could not be read.'));
    }
    if (!isMidi && data.length > MAX_CUSTOM_BYTES) return setProblem(t('That score is too big once unzipped (the limit is 400 KB).'));
    const r = await add({ title: title.trim() || file.name.replace(/\.[^.]+$/, ''), artist, kind: isMidi ? 'midi' : 'musicxml', data });
    if (!r.ok) return setProblem(r.error);
    setProblem(undefined);
    setTitle('');
    setArtist('');
    onAdded(r.song.title);
  }

  return (
    <Card tint={tint}>
      <div className={options.panel}>
        <h2>{isScore ? t('Add a song from a score') : t('Add a song from a MIDI file')}</h2>
        <p className={options.note}>
          {isScore
            ? t('Upload the score as a MusicXML file, or a PDF or picture of printed piano music. DuoKeys turns its notes into falling notes you can play.')
            : t('Upload a MIDI file. Its notes become falling notes you can play.')}{' '}
          {t('Leave the name empty to use the file name.')}
        </p>
        <NameFields title={title} artist={artist} setTitle={setTitle} setArtist={setArtist} placeholder={t('Leave empty to use the file name')} />
        <label style={labelStyle}>
          {isScore ? t('Score file (.musicxml, .xml, .mxl, .pdf, .png or .jpg)') : t('MIDI file (.mid or .midi)')}
          <input
            type="file"
            accept={isScore ? '.musicxml,.xml,.mxl,.pdf,.png,.jpg,.jpeg' : '.mid,.midi'}
            onChange={(e) => {
              void save(e.target.files?.[0]);
              e.target.value = '';
            }}
            style={field}
          />
        </label>
        {isReading && <p role="status">{t('Reading the score. This can take a minute.')}</p>}
        {needsReader && (
          <div role="alert" className={options.note}>
            <p>
              {t('Reading a PDF or picture needs the DuoKeys score reader running on this computer. It is free, needs Docker, and nothing leaves your computer. In a terminal, from the DuoKeys folder:')}
            </p>
            <pre style={{ overflowX: 'auto' }}>
              docker build -t duokeys-omr tools/omr{'\n'}docker run --rm -p 127.0.0.1:8765:8765 duokeys-omr
            </pre>
            <p>{t('Then choose the file again. A MusicXML file from MuseScore needs none of this.')}</p>
          </div>
        )}
        {scan && <ScanReview summary={scan.summary} isSaving={isSaving} onSave={(bpm) => void saveScan(bpm)} onCancel={() => setScan(undefined)} />}
        {problem && <p role="alert">{t(problem)}</p>}
      </div>
    </Card>
  );
}

function RenameForm({
  title,
  artist,
  onSave,
  onDone,
}: {
  title: string;
  artist: string;
  onSave(title: string, artist: string): Promise<{ ok: true } | { ok: false; error: string }>;
  onDone(): void;
}) {
  const t = useT();
  const [nm, setNm] = useState(title);
  const [a, setA] = useState(artist);
  const [problem, setProblem] = useState<string | undefined>();
  const field = { font: 'inherit', padding: '0.5rem 0.7rem', minHeight: '44px' } as const;
  return (
    <form
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(nm, a).then((r) => (r.ok ? onDone() : setProblem(r.error)));
      }}
    >
      <input aria-label={t('Song name')} value={nm} onChange={(e) => setNm(e.target.value)} style={field} />
      <input aria-label={t('Artist (optional)')} value={a} onChange={(e) => setA(e.target.value)} placeholder={t('Artist (optional)')} style={field} />
      {problem && <p role="alert">{t(problem)}</p>}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button accent="indigo" type="submit">{t('Save name')}</Button>
        <Button accent="indigo" variant="secondary" type="button" onClick={onDone}>{t('Cancel')}</Button>
      </div>
    </form>
  );
}

// Same logic as Free play: the tile's colour is the colour of the card it opens.
const TILES: { id: OptionId | 'library'; shape: PopShapeName; shapeColour: PopColour; colour: Tint; corner: PopCorner; name: string; hint: string }[] = [
  { id: 'library', shape: 'square', shapeColour: 'mustard', colour: 'cornflower', corner: 'tl', name: 'Song library', hint: '570+ piano pieces to search' },
  { id: 'paste', shape: 'circle', shapeColour: 'tomato', colour: 'mustard', corner: 'tr', name: 'Paste chords', hint: 'From a chord chart you like' },
  { id: 'midi', shape: 'quarter', shapeColour: 'cornflower', colour: 'peach', corner: 'br', name: 'Upload MIDI', hint: 'A .mid or .midi file' },
  { id: 'score', shape: 'arch', shapeColour: 'mustard', colour: 'cornflower', corner: 'bl', name: 'Upload a score', hint: 'MusicXML, PDF or picture' },
  { id: 'starter', shape: 'half', shapeColour: 'cornflower', colour: 'mustard', corner: 'tl', name: 'Starter pieces', hint: 'Short pieces to begin with' },
];

export default function SongsHubPage() {
  const t = useT();
  const [index, setIndex] = useState<ContentIndex | undefined>();
  const [open, setOpen] = useState<OptionId | undefined>();
  const [justAdded, setJustAdded] = useState<string | undefined>();
  const profile = useSessionStore((s) => s.profile);
  const loadLibrary = useLibraryStore((s) => s.loadLibrary);
  const customSongs = useCustomSongStore((s) => s.songs);
  const loadCustom = useCustomSongStore((s) => s.load);
  const removeCustom = useCustomSongStore((s) => s.remove);
  const renameCustom = useCustomSongStore((s) => s.rename);
  const [renaming, setRenaming] = useState<string | undefined>();
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

  const openTint: Tint = TILES.find((tl) => tl.id === open)?.colour ?? 'mustard';

  function added(title: string): void {
    setJustAdded(title);
    setOpen(undefined);
  }

  return (
    <PageShell back={{ href: '/studio', label: t('Studio') }}>
      <h1>{t('Songs')}</h1>
      <p>{t('Choose how to get a song.')}</p>

      <ActionGrid>
        {TILES.map((tile) => {
          const optionId = tile.id === 'library' ? undefined : tile.id;
          return optionId === undefined ? (
            <ActionCard
              key={tile.id}
              variant="tile"
              href="/studio/library"
              shape={tile.shape}
              shapeColour={tile.shapeColour}
              corner={tile.corner}
              colour={tile.colour}
              title={t(tile.name)}
              description={t(tile.hint)}
            />
          ) : (
            <ActionCard
              key={tile.id}
              variant="tile"
              onSelect={() => setOpen((cur) => (cur === optionId ? undefined : optionId))}
              selected={open === optionId}
              shape={tile.shape}
              shapeColour={tile.shapeColour}
              corner={tile.corner}
              colour={tile.colour}
              title={t(tile.name)}
              description={t(tile.hint)}
            />
          );
        })}
      </ActionGrid>

      {open === 'paste' && <PastePanel onAdded={added} tint={openTint} />}
      {open === 'midi' && <FilePanel way="midi" onAdded={added} tint={openTint} />}
      {open === 'score' && <FilePanel way="score" onAdded={added} tint={openTint} />}
      {open === 'starter' && (
        <Card tint={openTint}>
          <section aria-label={t('Starter pieces')} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2>{t('Starter pieces')}</h2>
            <ul className={css.list}>
              {index.pieces.map((piece) => (
                <li key={piece.id} className={css.row}>
                  <span className={css.tile} aria-hidden="true">♪</span>
                  <div className={css.body}>
                    <Link className={css.title} href={`/studio/play/${piece.defaultArrangementId}`}>{t(piece.title)}</Link>
                  </div>
                  <LibraryControl profileId={profile.id} arrangementId={piece.defaultArrangementId} />
                </li>
              ))}
            </ul>
          </section>
        </Card>
      )}

      <section aria-label={t('My songs')} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h2>{t('My songs')} ({total})</h2>
        {justAdded && <p role="status">{t('✓ “{title}” is saved in My songs.', { title: justAdded })}</p>}
        {total === 0 && <EmptyState title={t('Nothing here yet')}>{t('Pick one of the options above to add a song.')}</EmptyState>}
        <ul className={css.list}>
          {customSongs.map((s) => (
            <li key={s.id} className={css.row}>
              <span className={css.tile} aria-hidden="true">{s.title.trim().charAt(0).toUpperCase() || '♪'}</span>
              <div className={css.body}>
                {renaming === s.id ? (
                  <RenameForm
                    title={s.title}
                    artist={s.artist}
                    onSave={(nm, a) => renameCustom(s.id, nm, a)}
                    onDone={() => setRenaming(undefined)}
                  />
                ) : (
                  <>
                    <Link className={css.title} href={`/studio/play/${encodeURIComponent(s.id)}`}>{s.title}</Link>
                    {s.artist && <span className={css.composer}>{s.artist}</span>}
                  </>
                )}
                <span className={css.meta}><Pill tone="neutral">{t(KIND_LABEL[s.kind])}</Pill><Pill>{t('Mine')}</Pill></span>
              </div>
              <div className={css.actions}>
                <Link href={`/studio/play/${encodeURIComponent(s.id)}`}><Button accent="indigo">{t('Play')}</Button></Link>
                <Button accent="indigo" variant="secondary" onClick={() => setRenaming(s.id)}>{t('Rename')}</Button>
                <Button accent="indigo" variant="secondary" onClick={() => void removeCustom(s.id)}>{t('Remove')}</Button>
              </div>
              <LibraryControl profileId={profile.id} arrangementId={s.id} />
            </li>
          ))}
          {savedLibrary.map((s) => (
            <li key={s.id} className={css.row}>
              <span className={css.tile} aria-hidden="true">{s.composer.trim().charAt(0).toUpperCase() || '♪'}</span>
              <div className={css.body}>
                <Link className={css.title} href={`/studio/play/${s.id}`}>{t(s.title)}{s.opus ? ` · ${s.opus}` : ''}</Link>
                <span className={css.composer}>{s.composer}</span>
                <span className={css.meta}><Pill tone="neutral">{t('Library')}</Pill></span>
              </div>
              <div className={css.actions}>
                <Link href={`/studio/play/${s.id}`}><Button accent="indigo">{t('Play')}</Button></Link>
                <Button accent="indigo" variant="secondary" onClick={() => void removeSong(s.id)}>{t('Remove')}</Button>
              </div>
              <LibraryControl profileId={profile.id} arrangementId={s.id} />
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
