// FR-STU-017 / ADR-010 — the step between "the score reader finished" and "saved in My songs".
// A scanned score is never exactly right, so this says what was read and which bars look wrong
// before anything is saved. Presentational only: the Songs page does the reading and saving.

'use client';

import { useState } from 'react';
import { Button } from '../shared/Button';
import options from './SongOptions.module.css';

export interface ScanSummary {
  bars: number;
  noteCount: number;
  /** Bar numbers holding more beats than the time signature. */
  overlongBars: number[];
  /** Bar numbers holding fewer beats than the time signature. */
  shortBars: number[];
  /** False when the scan found no tempo marking, so the player sets one. */
  hasTempo: boolean;
  tempoBpm: number;
}

const barList = (bars: number[]): string => (bars.length > 8 ? `${bars.slice(0, 8).join(', ')} and ${bars.length - 8} more` : bars.join(', '));

export function ScanReview({
  summary,
  isSaving,
  onSave,
  onCancel,
}: {
  summary: ScanSummary;
  isSaving: boolean;
  onSave(tempoBpm: number | undefined): void;
  onCancel(): void;
}) {
  const [tempo, setTempo] = useState(String(summary.hasTempo ? summary.tempoBpm : 80));
  const tempoBpm = Number(tempo);
  const isTempoValid = summary.hasTempo || (Number.isFinite(tempoBpm) && tempoBpm >= 30 && tempoBpm <= 240);
  const problems = summary.overlongBars.length + summary.shortBars.length;

  return (
    <div className={options.panel} aria-label="Check the scanned score">
      <h3>Check what was read</h3>
      <p role="status">
        Read {summary.bars} bars and {summary.noteCount} notes.
      </p>
      {problems === 0 ? (
        <p className={options.note}>Every bar adds up. It is still worth listening to the first page before you rely on it.</p>
      ) : (
        <ul className={options.note}>
          {summary.overlongBars.length > 0 && <li>Bars {barList(summary.overlongBars)} hold too many beats, so a note or rhythm was misread.</li>}
          {summary.shortBars.length > 0 && <li>Bars {barList(summary.shortBars)} hold too few beats, so a note may be missing.</li>}
          <li>You can save it and play on. Those bars may sound wrong. Scanning works best on clean, printed piano music.</li>
        </ul>
      )}
      {!summary.hasTempo && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          The scan found no speed. Beats per minute
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={240}
            value={tempo}
            onChange={(e) => setTempo(e.target.value)}
            style={{ font: 'inherit', padding: '0.7rem 0.9rem', minHeight: '44px', width: '8rem' }}
          />
        </label>
      )}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Button accent="indigo" onClick={() => onSave(summary.hasTempo ? undefined : tempoBpm)} disabled={isSaving || !isTempoValid}>
          Save to My songs
        </Button>
        <Button accent="indigo" variant="secondary" onClick={onCancel} disabled={isSaving}>
          Discard
        </Button>
      </div>
    </div>
  );
}
