// TA-DAT-004 — Profile. Kept verbatim against docs/01-TECHNICAL-ARCHITECTURE.md
// (CLAUDE.md § 1.2) — if you change this shape, change it there too.

import type { MidiPitch } from '../midi/decode';

export interface Profile {
  id: string;
  displayName: string; // first name only (NFR-010)
  role: 'explorer' | 'student';
  keyboardRange: { low: MidiPitch; high: MidiPitch }; // ADR-009: 21-108
  latencyOffsetMs: number; // TA-CLK-004
  toleranceScale: number; // TA-MAT-006
  midiInputId?: string;
  avatar: string; // emoji or asset id
}
