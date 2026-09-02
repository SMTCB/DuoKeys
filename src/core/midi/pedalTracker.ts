// TA-MID-004 — sustain pedal state, distinguishing "key up" from "note stopped
// sounding". Kept close to the verbatim shape in docs/01-TECHNICAL-ARCHITECTURE.md.

import type { MidiPitch } from './decode';

const SUSTAIN_THRESHOLD = 64; // CC64 >= 64 = down

export class PedalTracker {
  private sustaining = false;
  private readonly held = new Set<MidiPitch>(); // physically down
  private readonly sustained = new Set<MidiPitch>(); // released but still sounding

  noteOn(p: MidiPitch): void {
    this.held.add(p);
    this.sustained.delete(p); // a fresh strike is no longer merely "sustained"
  }

  noteOff(p: MidiPitch): { keyUp: true; stoppedSounding: boolean } {
    this.held.delete(p);
    if (this.sustaining) {
      this.sustained.add(p);
      return { keyUp: true, stoppedSounding: false };
    }
    this.sustained.delete(p);
    return { keyUp: true, stoppedSounding: true };
  }

  cc64(value: number): { released: MidiPitch[] } {
    const wasSustaining = this.sustaining;
    this.sustaining = value >= SUSTAIN_THRESHOLD;

    if (wasSustaining && !this.sustaining) {
      const released = [...this.sustained].filter((p) => !this.held.has(p));
      this.sustained.clear();
      return { released };
    }
    return { released: [] };
  }

  isSustaining(): boolean {
    return this.sustaining;
  }
}
