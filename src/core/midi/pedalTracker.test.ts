import { describe, expect, it } from 'vitest';
import { PedalTracker } from './pedalTracker';
import { asMidiPitch } from './decode';

describe('PedalTracker', () => {
  // TS-U-MID-005
  it('reads the pedal as up at 63 and down at 64', () => {
    const tracker = new PedalTracker();
    tracker.cc64(63);
    expect(tracker.isSustaining()).toBe(false);
    tracker.cc64(64);
    expect(tracker.isSustaining()).toBe(true);
  });

  it('keeps a note sounding after key-up while the pedal is down', () => {
    const tracker = new PedalTracker();
    const c4 = asMidiPitch(60);
    tracker.cc64(127); // pedal down
    tracker.noteOn(c4);
    const result = tracker.noteOff(c4);
    expect(result).toEqual({ keyUp: true, stoppedSounding: false });
  });

  it('stops the note immediately when the pedal is up', () => {
    const tracker = new PedalTracker();
    const c4 = asMidiPitch(60);
    tracker.noteOn(c4);
    const result = tracker.noteOff(c4);
    expect(result).toEqual({ keyUp: true, stoppedSounding: true });
  });

  it('releases sustained notes when the pedal lifts, but not ones still held', () => {
    const tracker = new PedalTracker();
    const c4 = asMidiPitch(60);
    const d4 = asMidiPitch(62);
    tracker.cc64(127);
    tracker.noteOn(c4);
    tracker.noteOn(d4);
    tracker.noteOff(c4); // released key, still sustained
    // d4 remains physically held
    const { released } = tracker.cc64(0);
    expect(released).toEqual([c4]);
  });
});
