// Runtime session state (Zustand, TA-APP-001). Wires the live MIDI stream
// through the documented pipeline —
//   decode -> latencyShift -> pedalTracker -> matcher (onset) / noteStream (duration)
// (see src/core/midi/noteStream.ts's header comment) — into WaitMatcher and
// grading, and persists the finished attempt. This file is runtime/, not
// core/: it owns event-loop plumbing and adapter calls, but every decision
// (matching, grading) is delegated to core/ functions/classes untouched.

import { create } from 'zustand';
import type { Adapters } from '../bootstrap';
import { getAdapters } from '../bootstrap';
import type { Profile } from '../../core/profile/types';
import type { Arrangement, ContentNote } from '../../core/content/types';
import type { MidiConnectionState, MidiInputInfo } from '../../adapters/ports';
import { MidiDecoder, shiftTimestamp } from '../../core/midi/decode';
import { PedalTracker } from '../../core/midi/pedalTracker';
import { NoteStreamTracker } from '../../core/midi/noteStream';
import { WaitMatcher } from '../../core/match/waitMatcher';
import type { ExpectedNote, MatcherState } from '../../core/match/types';
import { notesInSection } from '../../core/content/sectionNotes';
import { MasterClock } from '../../core/time/masterClock';
import { asMillis } from '../../core/time/types';
import { computeGrade, type Grade, type NoteResult } from '../../core/grade/grade';
import { computeAttempt } from '../../core/data/attempt';
import { DEFAULT_PROFILE } from '../defaultProfile';

export { DEFAULT_PROFILE };

const APP_VERSION = '0.1.0-sprint1';

export type AttemptStatus = 'idle' | 'playing' | 'complete';

interface SessionState {
  adapters: Adapters;
  profile: Profile;

  midiInputs: MidiInputInfo[];
  midiConnectionState: MidiConnectionState;

  arrangement: Arrangement | undefined;
  activeNotes: ContentNote[] | undefined;
  clock: MasterClock | undefined;
  matcherState: MatcherState | undefined;
  attemptStatus: AttemptStatus;
  grade: Grade | undefined;

  refreshMidiInputs(): Promise<void>;
  selectMidiInput(id: string): Promise<void>;
  startArrangement(
    arrangement: Arrangement,
    trackId: string,
    attemptId: string,
    startedAtIso: string,
    targetSectionId?: string,
  ): Promise<void>;
}

let decoder: MidiDecoder | undefined;
let pedalTracker: PedalTracker | undefined;
let noteStream: NoteStreamTracker | undefined;
let matcher: WaitMatcher | undefined;
let perNote: NoteResult[] = [];
let allExpected: ExpectedNote[] = [];
let currentAttemptMeta:
  | { id: string; arrangementId: string; sectionId?: string; startedAtIso: string; startAudioSeconds: number }
  | undefined;
let unsubscribeMessage: (() => void) | undefined;

export const useSessionStore = create<SessionState>((set, get) => ({
  adapters: getAdapters(),
  profile: DEFAULT_PROFILE,

  midiInputs: [],
  midiConnectionState: 'disconnected',

  arrangement: undefined,
  activeNotes: undefined,
  clock: undefined,
  matcherState: undefined,
  attemptStatus: 'idle',
  grade: undefined,

  async refreshMidiInputs(): Promise<void> {
    const inputs = await get().adapters.midi.listInputs();
    set({ midiInputs: inputs });
  },

  async selectMidiInput(id: string): Promise<void> {
    const { adapters } = get();
    await adapters.audio.resume(); // user-gesture unlock, TA-AUD-003
    await adapters.midi.open(id);
    adapters.midi.onStateChange((s) => set({ midiConnectionState: s }));

    unsubscribeMessage?.();
    unsubscribeMessage = adapters.midi.onMessage((msg) => {
      const dec = decoder;
      const pedal = pedalTracker;
      const stream = noteStream;
      const m = matcher;
      if (!dec || !pedal || !stream || !m) return;

      const event = dec.decode(msg.data, msg.timeStamp);
      if (!event) return;
      const shifted = shiftTimestamp(event, asMillis(get().profile.latencyOffsetMs));

      if (shifted.kind === 'noteOn') {
        pedal.noteOn(shifted.pitch);
        stream.noteOn(shifted.pitch, shifted.velocity, shifted.timeStamp);
        const result = m.consume({ pitch: shifted.pitch, velocity: shifted.velocity });
        if (result.kind === 'correct' || result.kind === 'wrong') {
          perNote.push(
            result.kind === 'correct'
              ? { expectedId: result.expectedId, pitch: shifted.pitch, outcome: 'correct', deltaMs: result.deltaMs }
              : { expectedId: result.expectedId, pitch: result.pitch, outcome: 'wrong' },
          );
        } else if (result.kind === 'extra') {
          perNote.push({ pitch: result.pitch, outcome: 'extra' });
        }
        set({ matcherState: m.state() });

        if (m.state().complete) void finishAttempt(set, get);
      } else if (shifted.kind === 'noteOff') {
        const { stoppedSounding } = pedal.noteOff(shifted.pitch);
        if (stoppedSounding) stream.noteOff(shifted.pitch, shifted.timeStamp);
      } else if (shifted.kind === 'controlChange' && shifted.controller === 64) {
        const { released } = pedal.cc64(shifted.value);
        for (const pitch of released) stream.noteOff(pitch, shifted.timeStamp);
      }
    });
  },

  async startArrangement(arrangement, trackId, attemptId, startedAtIso, targetSectionId): Promise<void> {
    const { adapters, profile } = get();
    const track = arrangement.tracks.find((t) => t.id === trackId);
    if (!track) throw new Error(`sessionStore: arrangement "${arrangement.id}" has no track "${trackId}"`);

    const targetSection = targetSectionId
      ? arrangement.sections.find((s) => s.id === targetSectionId)
      : undefined;
    if (targetSectionId && !targetSection) {
      throw new Error(`sessionStore: arrangement "${arrangement.id}" has no section "${targetSectionId}"`);
    }
    const notesInScope = targetSection ? notesInSection(track.notes, targetSection) : track.notes;

    decoder = new MidiDecoder();
    pedalTracker = new PedalTracker();
    noteStream = new NoteStreamTracker();
    matcher = new WaitMatcher();
    perNote = [];

    allExpected = notesInScope.map((n: ContentNote) => ({
      id: n.id,
      pitch: n.pitch,
      atTick: n.startTick,
      groupId: n.groupId,
    }));
    matcher.expect(allExpected);

    const clock = new MasterClock(adapters.audio, arrangement.tempoMap);
    clock.start(targetSection ? targetSection.startTick : (arrangement.sections[0]?.startTick ?? track.notes[0]!.startTick));

    currentAttemptMeta = {
      id: attemptId,
      arrangementId: arrangement.id,
      ...(targetSectionId === undefined ? {} : { sectionId: targetSectionId }),
      startedAtIso,
      startAudioSeconds: adapters.audio.now() as number,
    };

    set({
      arrangement,
      activeNotes: notesInScope,
      clock,
      matcherState: matcher.state(),
      attemptStatus: 'playing',
      grade: undefined,
      profile,
    });
  },
}));

async function finishAttempt(
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
): Promise<void> {
  const meta = currentAttemptMeta;
  if (!meta) return;

  const grade = computeGrade(perNote, allExpected.length, {
    explorerFloor: get().profile.role === 'explorer',
  });

  const durationMs = ((get().adapters.audio.now() as number) - meta.startAudioSeconds) * 1000;

  const attempt = computeAttempt({
    id: meta.id,
    profileId: get().profile.id,
    arrangementId: meta.arrangementId,
    ...(meta.sectionId === undefined ? {} : { sectionId: meta.sectionId }),
    startedAtIso: meta.startedAtIso,
    durationMs,
    mode: 'wait',
    tempoScale: 1,
    grade,
    appVersion: APP_VERSION,
  });

  await get().adapters.storage.put('attempts', attempt);

  set({ grade, attemptStatus: 'complete' });
}
