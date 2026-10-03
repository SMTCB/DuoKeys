// Chord & progression explorer runtime state (Zustand, TA-APP-001), US-3.13.
// A separate store from sessionStore.ts and noteNinjaStore.ts — its own
// low-pressure gameplay loop (FR-STU-012: no timing requirement, no failure
// state) with its own MIDI wiring, modelled on noteNinjaStore.ts's pattern.
// Adapters are fetched lazily via getAdapters() inside each action, never
// stored eagerly at store-creation time.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import { rememberMidiInput, useSessionStore } from './sessionStore';
import { rememberedInputFirst } from '../../core/profile/midiPreference';
import type { MidiConnectionState, MidiInputInfo } from '../../adapters/ports';
import { MidiDecoder } from '../../core/midi/decode';
import { VELOCITY_FLOOR } from '../../core/match/types';
import { ChordMatcher, type ChordMatchResult } from '../../core/match/chordMatcher';
import { loadChordCatalogue } from '../../adapters/content/staticChords';
import type { ChordEntry, ChordIndex, PitchClass, ProgressionEntry } from '../../core/content/chordTypes';

interface ChordExplorerState {
  catalogue: ChordIndex | undefined;

  midiInputs: MidiInputInfo[];
  midiConnectionState: MidiConnectionState;

  selectedKey: PitchClass;
  selectedProgressionId: string | undefined;
  currentChordIndex: number;
  currentChordId: string | undefined;
  matchResult: ChordMatchResult | undefined;
  playedPitchClasses: readonly PitchClass[];

  loadCatalogue(): Promise<void>;
  refreshMidiInputs(): Promise<void>;
  selectMidiInput(id: string): Promise<void>;
  setKey(key: PitchClass): void;
  playChord(chordId: string): void;
  startProgression(progressionId: string): void;
  advanceProgression(): void;
}

let decoder: MidiDecoder | undefined;
let unsubscribeMessage: (() => void) | undefined;
const matcher = new ChordMatcher();

function findChord(catalogue: ChordIndex | undefined, chordId: string): ChordEntry | undefined {
  return catalogue?.chords.find((c) => c.id === chordId);
}

function findProgression(catalogue: ChordIndex | undefined, progressionId: string): ProgressionEntry | undefined {
  return catalogue?.progressions.find((p) => p.id === progressionId);
}

export const useChordExplorerStore = create<ChordExplorerState>((set, get) => ({
  catalogue: undefined,

  midiInputs: [],
  midiConnectionState: 'disconnected',

  selectedKey: 0 as PitchClass,
  selectedProgressionId: undefined,
  currentChordIndex: 0,
  currentChordId: undefined,
  matchResult: undefined,
  playedPitchClasses: [],

  async loadCatalogue(): Promise<void> {
    const catalogue = await loadChordCatalogue();
    set({ catalogue });
  },

  async refreshMidiInputs(): Promise<void> {
    const inputs = await getAdapters().midi.listInputs();
    set({ midiInputs: rememberedInputFirst(inputs, useSessionStore.getState().profile.midiInputId) });
  },

  async selectMidiInput(id: string): Promise<void> {
    const adapters = getAdapters();
    await adapters.audio.resume(); // user-gesture unlock, TA-AUD-003
    await adapters.midi.open(id);
    await rememberMidiInput(id);
    adapters.midi.onStateChange((s) => set({ midiConnectionState: s }));

    decoder = new MidiDecoder();

    unsubscribeMessage?.();
    unsubscribeMessage = adapters.midi.onMessage((msg) => {
      const dec = decoder;
      if (!dec) return;

      const event = dec.decode(msg.data, msg.timeStamp);
      if (!event || event.kind !== 'noteOn' || event.velocity < VELOCITY_FLOOR) return;

      if (get().currentChordId === undefined) return;
      const result = matcher.consume({ pitch: event.pitch, velocity: event.velocity, timeStamp: event.timeStamp });
      set({ matchResult: result, playedPitchClasses: matcher.state().played });
    });
  },

  setKey(key: PitchClass): void {
    set({ selectedKey: key, selectedProgressionId: undefined, currentChordIndex: 0 });
  },

  playChord(chordId: string): void {
    const chord = findChord(get().catalogue, chordId);
    if (!chord) return;
    matcher.setTarget(chord.midiNotes);
    set({ currentChordId: chordId, selectedProgressionId: undefined, matchResult: undefined, playedPitchClasses: [] });
  },

  startProgression(progressionId: string): void {
    const progression = findProgression(get().catalogue, progressionId);
    const firstChordId = progression?.chordIds[0];
    if (!progression || firstChordId === undefined) return;
    const chord = findChord(get().catalogue, firstChordId);
    if (!chord) return;
    matcher.setTarget(chord.midiNotes);
    set({
      selectedProgressionId: progressionId,
      currentChordIndex: 0,
      currentChordId: firstChordId,
      matchResult: undefined,
      playedPitchClasses: [],
    });
  },

  // FR-STU-012 — manual advance only; no auto-timer, consistent with the low-pressure framing.
  advanceProgression(): void {
    const { catalogue, selectedProgressionId, currentChordIndex } = get();
    const progression = selectedProgressionId ? findProgression(catalogue, selectedProgressionId) : undefined;
    if (!progression) return;
    const nextIndex = (currentChordIndex + 1) % progression.chordIds.length;
    const nextChordId = progression.chordIds[nextIndex];
    if (nextChordId === undefined) return;
    const chord = findChord(catalogue, nextChordId);
    if (!chord) return;
    matcher.setTarget(chord.midiNotes);
    set({
      currentChordIndex: nextIndex,
      currentChordId: nextChordId,
      matchResult: undefined,
      playedPitchClasses: [],
    });
  },
}));
