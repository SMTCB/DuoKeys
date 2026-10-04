// Runtime session state (Zustand, TA-APP-001). Wires the live MIDI stream
// through the documented pipeline —
//   decode -> latencyShift -> pedalTracker -> matcher (onset) / noteStream (duration)
// (see src/core/midi/noteStream.ts's header comment) — into WaitMatcher and
// grading, and persists the finished attempt. This file is runtime/, not
// core/: it owns event-loop plumbing and adapter calls, but every decision
// (matching, grading) is delegated to core/ functions/classes untouched.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import type { Profile } from '../../core/profile/types';
import type { Arrangement, ContentNote, Section } from '../../core/content/types';
import type { AudioBackend, MidiConnectionState, MidiInputInfo } from '../../adapters/ports';
import { MidiDecoder, shiftTimestamp, type MidiPitch } from '../../core/midi/decode';
import { PedalTracker } from '../../core/midi/pedalTracker';
import { NoteStreamTracker } from '../../core/midi/noteStream';
import { WaitMatcher } from '../../core/match/waitMatcher';
import { TimedMatcher } from '../../core/match/timedMatcher';
import type { ExpectedNote, Matcher, MatcherState } from '../../core/match/types';
import { notesInSection } from '../../core/content/sectionNotes';
import { MasterClock } from '../../core/time/masterClock';
import { asMillis, asTicks, type Ticks } from '../../core/time/types';
import { computeGrade, type Grade, type NoteResult } from '../../core/grade/grade';
import { classifyArticulation } from '../../core/grade/articulation';
import { reconcileMissed } from '../../core/grade/reconcileMissed';
import { computeAttempt } from '../../core/data/attempt';
import { DEFAULT_PROFILE } from '../defaultProfile';
import { rememberedInputFirst, withMidiInput } from '../../core/profile/midiPreference';

export type PracticeMode = 'wait' | 'timed';
/** FR-STU-005 — how the *other* tracks (e.g. the hand not being practised) sound. */
export type AccompanimentMode = 'silent' | 'sampler';

export { DEFAULT_PROFILE };

const APP_VERSION = '0.1.0-sprint1';

export type AttemptStatus = 'idle' | 'playing' | 'complete';

interface SessionState {
  profile: Profile;

  midiInputs: MidiInputInfo[];
  midiConnectionState: MidiConnectionState;

  arrangement: Arrangement | undefined;
  activeNotes: ContentNote[] | undefined;
  clock: MasterClock | undefined;
  matcherState: MatcherState | undefined;
  attemptStatus: AttemptStatus;
  grade: Grade | undefined;
  tempoScale: number;

  /** FR-STU-003 — set before starting; startArrangement reads it to seed MasterClock's loop. */
  loopRange: { startTick: Ticks; endTick: Ticks } | undefined;
  /** FR-STU-004 — only meaningful while loopRange is set. */
  autoRampEnabled: boolean;
  passNumber: number;
  lastPassGrade: Grade | undefined;

  /** FR-STU-005 — set before starting; startArrangement reads it to decide whether other tracks sound. */
  accompanimentMode: AccompanimentMode;
  /**
   * TA-MAT-002 — in wait mode the stream stops on the pending chord at the hit
   * line and only moves on once it has been played. On by default; turning it
   * off lets wait mode scroll on while still only grading pitch.
   */
  holdAtLine: boolean;

  setProfile(profile: Profile): void;
  refreshMidiInputs(): Promise<void>;
  selectMidiInput(id: string): Promise<void>;
  startArrangement(
    arrangement: Arrangement,
    trackId: string,
    attemptId: string,
    startedAtIso: string,
    targetSectionId?: string,
    mode?: PracticeMode,
  ): Promise<void>;
  setTempoScale(scale: number): void;
  setLoopRange(range: { startTick: Ticks; endTick: Ticks } | undefined): void;
  setAutoRamp(enabled: boolean): void;
  setAccompanimentMode(mode: AccompanimentMode): void;
  setHoldAtLine(hold: boolean): void;
  /** Ends a looping attempt, grading whatever was played in the pass in progress. */
  stopLoop(): Promise<void>;
}

/** FR-STU-003/FR-STU-005 — a track's notes restricted to a section and/or loop range, shared by the practised track and every accompaniment track so both scope identically. */
function scopeNotes(
  notes: readonly ContentNote[],
  section: Section | undefined,
  loopRange: { startTick: Ticks; endTick: Ticks } | undefined,
): ContentNote[] {
  const sectionScoped = section ? notesInSection(notes, section) : [...notes];
  return loopRange
    ? sectionScoped.filter(
        (n) =>
          (n.startTick as number) >= (loopRange.startTick as number) &&
          (n.startTick as number) < (loopRange.endTick as number),
      )
    : sectionScoped;
}

const ACCOMPANIMENT_VELOCITY = 70; // softer than a performed note, so it reads as backing (FR-STU-005)

/** FR-STU-005 — schedules every accompaniment track's notes against the clock in one call; Web Audio/Tone.js scheduling accepts future times directly, so no polling loop is needed. */
function scheduleAccompaniment(audio: AudioBackend, clock: MasterClock, notesByTrack: readonly ContentNote[][]): void {
  for (const notes of notesByTrack) {
    for (const n of notes) {
      const atStart = clock.ticksToAudio(n.startTick);
      const atEnd = clock.ticksToAudio(asTicks((n.startTick as number) + (n.durationTicks as number)));
      const handle = audio.playNote(n.pitch, ACCOMPANIMENT_VELOCITY, atStart);
      audio.stopNote(handle, atEnd);
    }
  }
}

let decoder: MidiDecoder | undefined;
let pedalTracker: PedalTracker | undefined;
let noteStream: NoteStreamTracker | undefined;
let matcher: Matcher | undefined;
let perNote: NoteResult[] = [];
let allExpected: ExpectedNote[] = [];
/** TA-GRD-006 — the scoped notes for the practised track, keyed by ExpectedNote.id, for target-duration lookups. */
let notesById: Map<string, ContentNote> = new Map();
/** TA-GRD-006 — a correctly-matched note awaiting its release, keyed by pitch (mirrors NoteStreamTracker's own keying). */
let openArticulation: Map<MidiPitch, { result: NoteResult; targetMs: number }> = new Map();
let currentAttemptMeta:
  | {
      id: string;
      arrangementId: string;
      sectionId?: string;
      startedAtIso: string;
      startAudioSeconds: number;
      mode: PracticeMode;
    }
  | undefined;
let unsubscribeMessage: (() => void) | undefined;
let loopPollId: number | undefined;
let holdPollId: number | undefined;
/** TA-MAT-002 — the onset tick of each matcher group, in matcher order, for holding the stream on the pending one. */
let groupTicks: number[] = [];
/** FR-STU-005 — scoped once in startArrangement, re-scheduled unchanged on each loop pass. */
let accompanimentNotesByTrack: ContentNote[][] = [];

function stopLoopPolling(): void {
  if (loopPollId !== undefined) {
    cancelAnimationFrame(loopPollId);
    loopPollId = undefined;
  }
}

function stopHoldPolling(): void {
  if (holdPollId !== undefined) {
    cancelAnimationFrame(holdPollId);
    holdPollId = undefined;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// TA-GRD-006 — a note's release (key-up-with-pedal-considered, or CC64 release
// while the key is up) closes its articulation classification. If the note
// was never opened by a correct match (extra note, or the classifier's
// target was unusable), this is a no-op.
function recordArticulation(pitch: MidiPitch, actualMs: number): void {
  const open = openArticulation.get(pitch);
  if (!open) return;
  openArticulation.delete(pitch);
  const outcome = classifyArticulation(actualMs, open.targetMs);
  if (outcome) open.result.articulation = outcome;
}

/**
 * US-1.07 — remember the chosen input on the active profile so it survives a
 * reload. Only a profile that is actually stored is written (the built-in
 * default is not); the write goes through the normal storage port, so it syncs.
 */
export async function rememberMidiInput(id: string): Promise<void> {
  const { storage } = getAdapters();
  const { profile, setProfile } = useSessionStore.getState();
  const next = withMidiInput(profile, id);
  if (next === profile) return;
  if (!(await storage.get<Profile>('profiles', profile.id))) return;
  await storage.put('profiles', next);
  setProfile(next);
}

export const useSessionStore = create<SessionState>((set, get) => ({
  profile: DEFAULT_PROFILE,

  midiInputs: [],
  midiConnectionState: 'disconnected',

  arrangement: undefined,
  activeNotes: undefined,
  clock: undefined,
  matcherState: undefined,
  attemptStatus: 'idle',
  grade: undefined,
  tempoScale: 1,

  loopRange: undefined,
  autoRampEnabled: false,
  passNumber: 1,
  lastPassGrade: undefined,
  accompanimentMode: 'silent',
  holdAtLine: true,

  setProfile(profile: Profile): void {
    set({ profile });
  },

  async refreshMidiInputs(): Promise<void> {
    const inputs = await getAdapters().midi.listInputs();
    set({ midiInputs: rememberedInputFirst(inputs, get().profile.midiInputId) });
  },

  async selectMidiInput(id: string): Promise<void> {
    const adapters = getAdapters();
    await adapters.audio.resume(); // user-gesture unlock, TA-AUD-003
    await adapters.midi.open(id);
    await rememberMidiInput(id);
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
        const result = m.consume({ pitch: shifted.pitch, velocity: shifted.velocity, timeStamp: shifted.timeStamp });
        if (result.kind === 'correct' || result.kind === 'wrong') {
          const entry: NoteResult =
            result.kind === 'correct'
              ? {
                  expectedId: result.expectedId,
                  pitch: shifted.pitch,
                  outcome: 'correct',
                  deltaMs: result.deltaMs,
                  // TA-GRD-003 — the raw onset time computeGrade needs for evennessCv.
                  onsetMs: shifted.timeStamp as number,
                }
              : { expectedId: result.expectedId, pitch: result.pitch, outcome: 'wrong' };
          perNote.push(entry);

          // TA-GRD-006 — open this note for articulation classification once
          // it's released. Written duration is read through MasterClock
          // (ADR-006), never a bare tick->ms conversion.
          if (result.kind === 'correct') {
            const note = notesById.get(result.expectedId);
            const clock = get().clock;
            if (note && clock) {
              const startAudio = clock.ticksToAudio(note.startTick) as number;
              const endAudio = clock.ticksToAudio(
                asTicks((note.startTick as number) + (note.durationTicks as number)),
              ) as number;
              openArticulation.set(shifted.pitch, { result: entry, targetMs: (endAudio - startAudio) * 1000 });
            }
          }
        } else if (result.kind === 'extra') {
          perNote.push({ pitch: result.pitch, outcome: 'extra' });
        }
        set({ matcherState: m.state() });

        // While looping (FR-STU-003), the pass boundary is the loop's tick
        // range (checkLoop, polled below), not the matcher completing early —
        // the attempt only ends when the adult calls stopLoop().
        if (m.state().complete && !get().loopRange) void finishAttempt(set, get);
      } else if (shifted.kind === 'noteOff') {
        const { stoppedSounding } = pedal.noteOff(shifted.pitch);
        if (stoppedSounding) {
          const closed = stream.noteOff(shifted.pitch, shifted.timeStamp);
          if (closed) recordArticulation(closed.pitch, closed.durationMs);
        }
      } else if (shifted.kind === 'controlChange' && shifted.controller === 64) {
        const { released } = pedal.cc64(shifted.value);
        for (const pitch of released) {
          const closed = stream.noteOff(pitch, shifted.timeStamp);
          if (closed) recordArticulation(closed.pitch, closed.durationMs);
        }
      }
    });
  },

  async startArrangement(arrangement, trackId, attemptId, startedAtIso, targetSectionId, mode = 'wait'): Promise<void> {
    const adapters = getAdapters();
    const { profile } = get();
    const track = arrangement.tracks.find((t) => t.id === trackId);
    if (!track) throw new Error(`sessionStore: arrangement "${arrangement.id}" has no track "${trackId}"`);

    const targetSection = targetSectionId
      ? arrangement.sections.find((s) => s.id === targetSectionId)
      : undefined;
    if (targetSectionId && !targetSection) {
      throw new Error(`sessionStore: arrangement "${arrangement.id}" has no section "${targetSectionId}"`);
    }
    const loopRange = get().loopRange;
    const notesInScope = scopeNotes(track.notes, targetSection, loopRange);
    // FR-STU-016 — a song's `both` track repeats what `rh` and `lh` already say, so it is never
    // accompaniment, and practising it leaves nothing else to accompany.
    const otherTracks = arrangement.tracks.filter((t) => t.id !== trackId && t.id !== 'both' && trackId !== 'both');
    accompanimentNotesByTrack = otherTracks.map((t) => scopeNotes(t.notes, targetSection, loopRange));

    decoder = new MidiDecoder();
    pedalTracker = new PedalTracker();
    noteStream = new NoteStreamTracker();
    perNote = [];
    openArticulation = new Map();
    stopLoopPolling();
    stopHoldPolling();

    allExpected = notesInScope.map((n: ContentNote) => ({
      id: n.id,
      pitch: n.pitch,
      atTick: n.startTick,
      groupId: n.groupId,
    }));
    notesById = new Map(notesInScope.map((n) => [n.id, n]));
    const tickOfGroup = new Map<string, number>();
    for (const e of allExpected) if (!tickOfGroup.has(e.groupId)) tickOfGroup.set(e.groupId, e.atTick as number);
    groupTicks = [...tickOfGroup.values()];

    const clock = new MasterClock(adapters.audio, arrangement.tempoMap);
    const startTick = loopRange
      ? loopRange.startTick
      : (targetSection ? targetSection.startTick : (arrangement.sections[0]?.startTick ?? track.notes[0]!.startTick));
    clock.start(startTick);
    if (loopRange) clock.setLoop(loopRange.startTick, loopRange.endTick);
    // A held stream would leave a pre-scheduled sampler part playing on its own, so the two never combine.
    const isHolding = mode === 'wait' && get().holdAtLine && get().accompanimentMode !== 'sampler';
    if (get().accompanimentMode === 'sampler' && !isHolding) {
      scheduleAccompaniment(adapters.audio, clock, accompanimentNotesByTrack);
    }

    // ADR-006 — timing is always read through MasterClock, never performance.now() directly.
    matcher =
      mode === 'timed'
        ? new TimedMatcher(
            { now: () => clock.nowAudio(), ticksToSeconds: (t) => clock.ticksToAudio(t) },
            arrangement.tempoMap[0]?.bpm ?? 120,
            profile.toleranceScale,
          )
        : new WaitMatcher();
    matcher.expect(allExpected);

    currentAttemptMeta = {
      id: attemptId,
      arrangementId: arrangement.id,
      ...(targetSectionId === undefined ? {} : { sectionId: targetSectionId }),
      startedAtIso,
      startAudioSeconds: adapters.audio.now() as number,
      mode,
    };

    set({
      arrangement,
      activeNotes: notesInScope,
      clock,
      matcherState: matcher.state(),
      attemptStatus: 'playing',
      grade: undefined,
      profile,
      tempoScale: 1,
      passNumber: 1,
      lastPassGrade: undefined,
    });

    if (loopRange) startLoopPolling(set, get);
    if (isHolding) startHoldPolling(get);
  },

  setTempoScale(scale: number): void {
    get().clock?.setTempoScale(scale);
    set({ tempoScale: scale });
  },

  setLoopRange(range: { startTick: Ticks; endTick: Ticks } | undefined): void {
    set({ loopRange: range });
  },

  setAutoRamp(enabled: boolean): void {
    set({ autoRampEnabled: enabled });
  },

  setAccompanimentMode(mode: AccompanimentMode): void {
    set({ accompanimentMode: mode });
  },

  setHoldAtLine(hold: boolean): void {
    set({ holdAtLine: hold });
  },

  async stopLoop(): Promise<void> {
    stopLoopPolling();
    get().clock?.clearLoop();
    set({ loopRange: undefined });
    await finishAttempt(set, get);
  },
}));

// TA-MAT-002 — each frame: once the stream reaches the pending chord's onset it
// is held there; the moment the matcher moves on to the next chord it runs again.
function startHoldPolling(get: () => SessionState): void {
  let heldIndex = -1;
  const poll = (): void => {
    const clock = get().clock;
    const m = matcher;
    if (!clock || !m || get().attemptStatus !== 'playing') return;
    const { groupIndex, complete } = m.state();
    if (complete) return;
    const tick = groupTicks[groupIndex];
    if (tick !== undefined) {
      if (clock.isHeld) {
        if (groupIndex !== heldIndex) clock.resume();
      } else if ((clock.audioToTicks(clock.nowAudio()) as number) >= tick) {
        clock.holdAt(asTicks(tick));
        heldIndex = groupIndex;
      }
    }
    holdPollId = requestAnimationFrame(poll);
  };
  holdPollId = requestAnimationFrame(poll);
}

function startLoopPolling(set: (partial: Partial<SessionState>) => void, get: () => SessionState): void {
  const poll = (): void => {
    const clock = get().clock;
    if (!clock || !get().loopRange) return; // loop was cleared/stopped elsewhere
    if (clock.checkLoop()) finishLoopPass(set, get);
    loopPollId = requestAnimationFrame(poll);
  };
  loopPollId = requestAnimationFrame(poll);
}

// US-3.06 — called each time checkLoop() reports the loop range was crossed.
// Grades the pass just finished, applies the auto-ramp, and re-arms the
// matcher for the next pass without ending the attempt.
function finishLoopPass(set: (partial: Partial<SessionState>) => void, get: () => SessionState): void {
  const passGrade = computeGrade(reconcileMissed(allExpected, perNote), allExpected.length, {
    explorerFloor: get().profile.role === 'explorer',
  });

  let tempoScale = get().tempoScale;
  if (get().autoRampEnabled) {
    const step = 0.05;
    tempoScale =
      passGrade.accuracy === 1 ? Math.min(1, round2(tempoScale + step)) : Math.max(0.3, round2(tempoScale - step));
    get().clock?.setTempoScale(tempoScale);
  }

  perNote = [];
  openArticulation = new Map();
  matcher?.expect(allExpected);

  // US-3.07 — each pass restarts the clock at loopStartTick, so a sampler
  // accompaniment must be rescheduled against the new pass's audio times.
  const clock = get().clock;
  if (clock && get().accompanimentMode === 'sampler') {
    scheduleAccompaniment(getAdapters().audio, clock, accompanimentNotesByTrack);
  }

  set({
    passNumber: get().passNumber + 1,
    lastPassGrade: passGrade,
    tempoScale,
    matcherState: matcher?.state(),
  });
}

async function finishAttempt(
  set: (partial: Partial<SessionState>) => void,
  get: () => SessionState,
): Promise<void> {
  stopHoldPolling();
  const meta = currentAttemptMeta;
  if (!meta) return;

  const grade = computeGrade(reconcileMissed(allExpected, perNote), allExpected.length, {
    explorerFloor: get().profile.role === 'explorer',
  });

  const durationMs = ((getAdapters().audio.now() as number) - meta.startAudioSeconds) * 1000;

  const attempt = computeAttempt({
    id: meta.id,
    profileId: get().profile.id,
    arrangementId: meta.arrangementId,
    ...(meta.sectionId === undefined ? {} : { sectionId: meta.sectionId }),
    startedAtIso: meta.startedAtIso,
    durationMs,
    mode: meta.mode,
    tempoScale: get().tempoScale,
    grade,
    appVersion: APP_VERSION,
  });

  await getAdapters().storage.put('attempts', attempt);

  getAdapters().audio.playSample('star-earned');
  set({ grade, attemptStatus: 'complete' });
}
