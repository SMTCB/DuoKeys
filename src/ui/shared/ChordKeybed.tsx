// FR-STU-012 — a small one-octave keybed showing which pitch classes a chord
// needs and which have been played, for the chord & progression explorer.
// Reuses pitchToX (TA-REN-002) for the same white/black-key layout as the
// falling-notes view, over a fixed one-octave MidiPitch range — chords are
// matched octave-invariant (TA-MAT-007), so only pitch class matters here.

import { asMidiPitch } from '../../core/midi/decode';
import { pitchToX } from '../falling/pitchToX';
import type { PitchClass } from '../../core/content/chordTypes';

export interface ChordKeybedProps {
  target: readonly PitchClass[];
  played: readonly PitchClass[];
}

const WHITE_KEY_PX = 40;
const KEY_HEIGHT_PX = 120;
const BLACK_KEY_HEIGHT_PX = 76;
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

  return (
    <div style={{ position: 'relative', width: 7 * WHITE_KEY_PX + 2, height: KEY_HEIGHT_PX }}>
      {keys
        .filter((k) => k.isWhite)
        .map((k) => (
          <div
            key={k.pitchClass}
            style={{
              position: 'absolute',
              left: k.x * WHITE_KEY_PX,
              top: 0,
              width: WHITE_KEY_PX - 2,
              height: KEY_HEIGHT_PX,
              background: k.isPlayed ? 'var(--indigo-deep)' : k.isTarget ? 'var(--indigo-tint)' : '#fff',
              border: '1px solid #ccc',
              borderRadius: '0 0 4px 4px',
            }}
          />
        ))}
      {keys
        .filter((k) => !k.isWhite)
        .map((k) => (
          <div
            key={k.pitchClass}
            style={{
              position: 'absolute',
              left: k.x * WHITE_KEY_PX,
              top: 0,
              width: k.widthUnits * WHITE_KEY_PX - 2,
              height: BLACK_KEY_HEIGHT_PX,
              background: k.isPlayed ? 'var(--indigo-deep)' : k.isTarget ? '#6a5fa8' : '#222',
              border: '1px solid #111',
              borderRadius: '0 0 3px 3px',
              zIndex: 1,
            }}
          />
        ))}
    </div>
  );
}
