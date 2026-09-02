import { describe, expect, it } from 'vitest';
import { NoteStreamTracker } from './noteStream';
import { asMidiPitch } from './decode';
import { asMillis } from '../time/types';

describe('NoteStreamTracker', () => {
  // TS-U-MID-009
  it('pairs note-on/off into one NoteEvent with duration', () => {
    const tracker = new NoteStreamTracker();
    const c4 = asMidiPitch(60);
    tracker.noteOn(c4, 100, asMillis(0));
    const event = tracker.noteOff(c4, asMillis(250));
    expect(event).toEqual({ pitch: c4, startTimeStamp: 0, durationMs: 250, velocity: 100 });
  });

  // TS-U-MID-010
  it('ignores an unmatched note-off', () => {
    const tracker = new NoteStreamTracker();
    const event = tracker.noteOff(asMidiPitch(60), asMillis(100));
    expect(event).toBeUndefined();
  });

  // TS-U-MID-011
  it('closes the first note when a second note-on for the same pitch arrives', () => {
    const tracker = new NoteStreamTracker();
    const c4 = asMidiPitch(60);
    const opened = tracker.noteOn(c4, 100, asMillis(0));
    expect(opened).toBeUndefined();
    const closedFirst = tracker.noteOn(c4, 90, asMillis(300));
    expect(closedFirst).toEqual({ pitch: c4, startTimeStamp: 0, durationMs: 300, velocity: 100 });
    const closedSecond = tracker.noteOff(c4, asMillis(500));
    expect(closedSecond).toEqual({ pitch: c4, startTimeStamp: 300, durationMs: 200, velocity: 90 });
  });
});
