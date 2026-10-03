// FR-STU-012 — a small one-octave keybed showing which pitch classes a chord
// needs and which have been played, for the chord & progression explorer.
// Reuses pitchToX (TA-REN-002) for the same white/black-key layout as the
// falling-notes view, over a fixed one-octave MidiPitch range — chords are
// matched octave-invariant (TA-MAT-007), so only pitch class matters here.
// US-3.21 — drawn on the design tokens; a key to play carries a dot and a
// played key a tick, so colour is never the only cue (NFR-008).

import { asMidiPitch } from '../../core/midi/decode';
import { pitchToX } from '../falling/pitchToX';
import type { PitchClass } from '../../core/content/chordTypes';
import styles from './ChordKeybed.module.css';

export interface ChordKeybedProps {
  target: readonly PitchClass[];
  played: readonly PitchClass[];
}

const WHITE_KEY_PX = 40;
const OCTAVE_RANGE = { low: asMidiPitch(60), high: asMidiPitch(71) };

export function ChordKeybed({ target, played }: ChordKeybedProps) {
  const targetSet = new Set(target);
  const playedSet = new Set(played);

  const keys = Array.from({ length: 12 }, (_, pitchClass) => {
    const pitch = asMidiPitch(60 + pitchClass);
    const { x, isWhite, widthUnits } = pitchToX(pitch, OCTAVE_RANGE);
    const isTarget = targetSet.has(pitchClass as PitchClass);
    const isPlayed = playedSet.has(pitchClass as PitchClass);
    return { pitchClass, x, isWhite, widthUnits, isTarget, isPlayed };
  });

  const keyClass = (k: (typeof keys)[number]) =>
    [k.isWhite ? styles.white : styles.black, k.isPlayed ? styles.played : k.isTarget ? styles.target : '']
      .filter(Boolean)
      .join(' ');

  return (
    <div className={styles.wrap}>
      <div className={styles.bed} style={{ width: 7 * WHITE_KEY_PX + 2 }}>
        {[...keys.filter((k) => k.isWhite), ...keys.filter((k) => !k.isWhite)].map((k) => (
          <div
            key={k.pitchClass}
            className={keyClass(k)}
            style={{ left: k.x * WHITE_KEY_PX, width: k.widthUnits * WHITE_KEY_PX - 2 }}
          >
            {(k.isTarget || k.isPlayed) && (
              <span className={styles.mark} aria-hidden="true">
                {k.isPlayed ? '✓' : '●'}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className={styles.legend}>
        <span>● to play</span>
        <span>✓ played</span>
      </p>
    </div>
  );
}
