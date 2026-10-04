// TA-REN-001 — the letter name of a MIDI pitch, shown on falling notes and the keybed
// so a player never has to count keys on the diagram. Middle C (60) is C4.

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function noteName(pitch: number, withOctave = true): string {
  const name = NAMES[((pitch % 12) + 12) % 12]!;
  return withOctave ? `${name}${Math.floor(pitch / 12) - 1}` : name;
}
