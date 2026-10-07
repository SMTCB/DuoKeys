// US-2.13 / US-2.19 — the note(s) on a piano score (treble over bass staff), for the
// Explorer screens. Whole notes only: no rhythm to read, just where the note sits.
// Sharps are drawn with a ♯ in front of the natural below them.

const HALF = 9; // vertical distance between a line and the next space
const STEP_TOP = 42; // highest step in view (a few steps above the treble staff), grown for higher notes
const STEP_BOTTOM = 14; // lowest step in view, grown for lower notes
const LEFT = 70;
const WIDTH = 300;
const NOTE_X = 210;

const LETTER_INDEX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // pitch class -> letter C..B (sharps share the letter below)
const IS_SHARP = [false, true, false, true, false, false, true, false, true, false, true, false];

/** Diatonic step: letters counted up from C0 = 0, so middle C (C4) = 28. */
function stepOf(pitch: number): number {
  return (Math.floor(pitch / 12) - 1) * 7 + LETTER_INDEX[((pitch % 12) + 12) % 12]!;
}

const TREBLE_LINES = [30, 32, 34, 36, 38]; // E4 G4 B4 D5 F5
const BASS_LINES = [18, 20, 22, 24, 26]; // G2 B2 D3 F3 A3

const yFrom = (top: number) => (step: number): number => (top - step) * HALF + 20;

/** Even steps that need a short line to carry a note on or beyond them. */
function ledgerSteps(step: number): number[] {
  const out: number[] = [];
  if (step >= 28 && step <= 29) {
    if (step === 28) out.push(28);
  } else if (step > 38) {
    for (let s = 40; s <= step; s += 2) out.push(s);
  } else if (step < 18) {
    for (let s = 16; s >= step; s -= 2) out.push(s);
  } else if (step === 28) {
    out.push(28);
  }
  return out;
}

export function NoteStaff({ pitches }: { pitches: readonly number[] }) {
  const sorted = [...new Set(pitches)].sort((a, b) => a - b);
  const top = Math.max(STEP_TOP, ...sorted.map((p) => stepOf(p) + 3));
  const bottom = Math.min(STEP_BOTTOM, ...sorted.map((p) => stepOf(p) - 3));
  const y = yFrom(top);
  const height = (top - bottom) * HALF + 40;
  const heads = sorted.map((pitch, i) => {
    const step = stepOf(pitch);
    const prev = sorted[i - 1];
    const isCrowded = prev !== undefined && step - stepOf(prev) <= 1;
    return { pitch, step, isSharp: IS_SHARP[pitch % 12]!, dx: isCrowded ? 22 : 0 };
  });
  const line = (step: number, key: string) => (
    <line key={key} x1={LEFT} x2={WIDTH} y1={y(step)} y2={y(step)} stroke="var(--app-ink)" strokeWidth={1.5} />
  );

  return (
    <svg
      viewBox={`0 0 ${WIDTH + 20} ${height}`}
      role="img"
      aria-label="The note on a piano score"
      style={{ width: '100%', maxWidth: 260, height: 'auto' }}
    >
      {TREBLE_LINES.map((s) => line(s, `t${s}`))}
      {BASS_LINES.map((s) => line(s, `b${s}`))}
      <line x1={LEFT} x2={LEFT} y1={y(38)} y2={y(18)} stroke="var(--app-ink)" strokeWidth={2} />
      <text x={LEFT + 6} y={y(30) + 10} fontSize={80} fill="var(--app-ink)" aria-hidden="true">
        {'\u{1D11E}'}
      </text>
      <text x={LEFT + 6} y={y(22) + 2} fontSize={58} fill="var(--app-ink)" aria-hidden="true">
        {'\u{1D122}'}
      </text>
      {heads.map((h) => (
        <g key={h.pitch}>
          {ledgerSteps(h.step).map((s) => (
            <line
              key={s}
              x1={NOTE_X + h.dx - 20}
              x2={NOTE_X + h.dx + 20}
              y1={y(s)}
              y2={y(s)}
              stroke="var(--app-ink)"
              strokeWidth={1.5}
            />
          ))}
          {h.isSharp && (
            <text x={NOTE_X + h.dx - 36} y={y(h.step) + 8} fontSize={26} fill="var(--role-deep)">
              ♯
            </text>
          )}
          <ellipse
            cx={NOTE_X + h.dx}
            cy={y(h.step)}
            rx={13}
            ry={HALF - 1}
            fill="var(--role)"
            stroke="var(--role-deep)"
            strokeWidth={2.5}
            transform={`rotate(-18 ${NOTE_X + h.dx} ${y(h.step)})`}
          />
        </g>
      ))}
    </svg>
  );
}
