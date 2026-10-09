// US-2.13 / US-2.19 — a two-octave keyboard that lights the key(s) being asked for or
// played, for the Explorer screens. Same white/black layout as the falling view
// (pitchToX, TA-REN-002). The lit key carries a dot as well as the colour (NFR-008).

import { asMidiPitch } from '../../core/midi/decode';
import { useNoteName, useT } from '../i18n/useT';
import { pitchToX } from '../falling/pitchToX';

const UNIT = 40;
const WHITE_HEIGHT = 150;
const BLACK_HEIGHT = 92;

/** Two octaves from a C, placed so the note is not at an edge. */
export function keysWindowStart(pitches: readonly number[]): number {
  const first = Math.min(...pitches);
  const octaveStart = Math.floor(first / 12) * 12;
  return first % 12 < 6 ? octaveStart - 12 : octaveStart;
}

export function NoteKeys({ pitches }: { pitches: readonly number[] }) {
  const noteName = useNoteName();
  const t = useT();
  const start = Math.max(21, keysWindowStart(pitches.length > 0 ? pitches : [60]));
  const range = { low: asMidiPitch(start), high: asMidiPitch(Math.min(108, start + 24)) };
  const lit = new Set(pitches);
  const keys: { pitch: number; x: number; isWhite: boolean; widthUnits: number }[] = [];
  for (let p = range.low as number; p <= (range.high as number); p++) {
    keys.push({ pitch: p, ...pitchToX(asMidiPitch(p), range) });
  }
  const width = (pitchToX(range.high, range).x + 1) * UNIT;

  const draw = (isWhitePass: boolean) =>
    keys
      .filter((k) => k.isWhite === isWhitePass)
      .map((k) => {
        const isLit = lit.has(k.pitch);
        const w = k.widthUnits * UNIT - 2;
        const h = k.isWhite ? WHITE_HEIGHT : BLACK_HEIGHT;
        const x = k.x * UNIT + 1;
        return (
          <g key={k.pitch}>
            <rect
              x={x}
              y={1}
              width={w}
              height={h}
              rx={5}
              fill={isLit ? 'var(--role)' : k.isWhite ? 'var(--app-surface)' : 'var(--app-ink)'}
              stroke={isLit ? 'var(--role-deep)' : 'var(--app-ink)'}
              strokeWidth={isLit ? 3 : 1.5}
            />
            {isLit && (
              <>
                <circle cx={x + w / 2} cy={h - 40} r={5} fill="#ffffff" />
                <text x={x + w / 2} y={h - 12} textAnchor="middle" fontSize={k.isWhite ? 18 : 13} fontWeight={800} fill="#ffffff">
                  {noteName(k.pitch, false)}
                </text>
              </>
            )}
            {k.isWhite && !isLit && (
              <text
                x={x + w / 2}
                y={h - 9}
                textAnchor="middle"
                fontSize={k.pitch % 12 === 0 ? 15 : 13}
                fontWeight={k.pitch % 12 === 0 ? 800 : 600}
                fill="var(--app-ink)"
                opacity={k.pitch % 12 === 0 ? 1 : 0.55}
              >
                {k.pitch % 12 === 0 ? noteName(k.pitch) : noteName(k.pitch, false)}
              </text>
            )}
          </g>
        );
      });

  return (
    <svg
      viewBox={`0 0 ${width + 2} ${WHITE_HEIGHT + 2}`}
      role="img"
      aria-label={t('Piano keys with the note highlighted')}
      style={{ width: '100%', maxWidth: 420, height: 'auto' }}
    >
      {draw(true)}
      {draw(false)}
    </svg>
  );
}
