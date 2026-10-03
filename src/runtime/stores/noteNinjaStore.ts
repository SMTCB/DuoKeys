// Note Ninja runtime state (Zustand, TA-APP-001), US-2.13/US-2.14. A separate
// store from sessionStore.ts — a different gameplay loop (single-card
// flashcards, no arrangement, no MasterClock) with its own MIDI wiring.
// Adapters are fetched lazily via getAdapters() inside each action, never
// stored eagerly at store-creation time.

import { create } from 'zustand';
import { getAdapters } from '../bootstrap';
import { DEFAULT_PROFILE } from '../defaultProfile';
import type { Profile } from '../../core/profile/types';
import type { MidiConnectionState, MidiInputInfo } from '../../adapters/ports';
import { MidiDecoder } from '../../core/midi/decode';
import type { MidiPitch } from '../../core/midi/decode';
import type { Seconds } from '../../core/time/types';
import { asMillis } from '../../core/time/types';
import { VELOCITY_FLOOR } from '../../core/match/types';
import { classifyResponse, type ResponseBand } from '../../core/flashcards/responseBand';
import { NOTE_NINJA_POOL } from '../../core/flashcards/deck';
import { reviewCard } from '../../core/flashcards/scheduler';
import type { Flashcard } from '../../core/data/flashcard';
import { midiPitchToNoteName } from '../../core/content/noteName';

interface NoteNinjaState {
  midiInputs: MidiInputInfo[];
  midiConnectionState: MidiConnectionState;

  currentPitch: MidiPitch | undefined;
  cardShownAtSeconds: Seconds | undefined;
  hintShown: boolean;
  lastResult: { band: ResponseBand; pitch: MidiPitch } | undefined;
  streak: number;

  setProfile(profile: Profile): void;
  refreshMidiInputs(): Promise<void>;
  selectMidiInput(id: string): Promise<void>;
  startSession(): Promise<void>;
  nextCard(): Promise<void>;
  revealHint(): void;
}

let decoder: MidiDecoder | undefined;
let unsubscribeMessage: (() => void) | undefined;
let currentCard: Flashcard | undefined;
let activeProfile: Profile = DEFAULT_PROFILE;

/** TA-DAT-006 — this profile's due flashcards, seeding any pool pitch that has never been drawn before. */
async function loadDueCards(now: number): Promise<Flashcard[]> {
  const { storage } = getAdapters();
  const profileId = activeProfile.id;
  const existing = await storage.query<Flashcard>('flashcards', 'profileId+dueAt', {
    lower: profileId,
    upper: profileId,
  });

  const seeded: Flashcard[] = [];
  for (const pitch of NOTE_NINJA_POOL) {
    const cardId = midiPitchToNoteName(pitch);
    if (existing.some((c) => c.cardId === cardId)) continue;
    const card: Flashcard = { profileId, cardId, pitch, box: 1, dueAtMs: asMillis(now) };
    await storage.put('flashcards', card);
    seeded.push(card);
  }

  return [...existing, ...seeded];
}

function pickCard(cards: readonly Flashcard[], now: number, exclude: MidiPitch | undefined): Flashcard {
  const due = cards.filter((c) => (c.dueAtMs as number) <= now);
  const pool = due.length > 0 ? due : cards;
  const sorted = [...pool].sort((a, b) => (a.dueAtMs as number) - (b.dueAtMs as number));
  return sorted.find((c) => c.pitch !== exclude) ?? sorted[0]!;
}

async function drawCard(exclude: MidiPitch | undefined): Promise<Flashcard> {
  const now = getAdapters().audio.now() as number;
  const cards = await loadDueCards(now);
  return pickCard(cards, now, exclude);
}

export const useNoteNinjaStore = create<NoteNinjaState>((set, get) => ({
  midiInputs: [],
  midiConnectionState: 'disconnected',

  currentPitch: undefined,
  cardShownAtSeconds: undefined,
  hintShown: false,
  lastResult: undefined,
  streak: 0,

  setProfile(profile: Profile): void {
    activeProfile = profile;
  },

  async refreshMidiInputs(): Promise<void> {
    const inputs = await getAdapters().midi.listInputs();
    set({ midiInputs: inputs });
  },

  async selectMidiInput(id: string): Promise<void> {
    const adapters = getAdapters();
    await adapters.audio.resume(); // user-gesture unlock, TA-AUD-003
    await adapters.midi.open(id);
    adapters.midi.onStateChange((s) => set({ midiConnectionState: s }));

    decoder = new MidiDecoder();

    unsubscribeMessage?.();
    unsubscribeMessage = adapters.midi.onMessage((msg) => {
      const dec = decoder;
      if (!dec) return;

      const event = dec.decode(msg.data, msg.timeStamp);
      if (!event || event.kind !== 'noteOn' || event.velocity < VELOCITY_FLOOR) return;

      const { currentPitch, cardShownAtSeconds } = get();
      if (currentPitch === undefined || cardShownAtSeconds === undefined) return;

      if (event.pitch === currentPitch) {
        const now = getAdapters().audio.now() as number;
        const elapsedSeconds = now - (cardShownAtSeconds as number);
        const band = classifyResponse(elapsedSeconds);
        // FR-EXP-003 — there is no failure state; every accepted answer, hinted or not, continues the streak.
        set((state) => ({ lastResult: { band, pitch: event.pitch }, streak: state.streak + 1 }));

        const card = currentCard;
        if (card) void getAdapters().storage.put('flashcards', reviewCard(card, band, now * 1000));
      } else {
        // FR-EXP-005 — a wrong key reveals the hint immediately, same as the 6s timeout, and the
        // card stays until the right key is played. This is not a "wrong answer ending the game".
        set({ hintShown: true });
      }
    });
  },

  async startSession(): Promise<void> {
    const card = await drawCard(undefined);
    currentCard = card;
    set({
      currentPitch: card.pitch,
      cardShownAtSeconds: getAdapters().audio.now(),
      hintShown: false,
      lastResult: undefined,
      streak: 0,
    });
  },

  async nextCard(): Promise<void> {
    const card = await drawCard(get().currentPitch);
    currentCard = card;
    set({
      currentPitch: card.pitch,
      cardShownAtSeconds: getAdapters().audio.now(),
      hintShown: false,
      lastResult: undefined,
    });
  },

  revealHint(): void {
    set({ hintShown: true });
  },
}));
