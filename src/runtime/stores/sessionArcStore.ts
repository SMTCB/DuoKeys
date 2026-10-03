// TA-APP-005 — session arc runtime state (Zustand, TA-APP-001), US-2.17.
// Orchestration only: sequences existing routes (free play, the quest map's
// practice route) rather than owning any MIDI/audio wiring of its own.

import { create } from 'zustand';
import { buildSessionArc, type ArcStep } from '../../core/session/arc';
import type { SectionProgress } from '../../core/progression/progression';

interface SessionArcState {
  plan: ArcStep[] | undefined;
  currentIndex: number;
  active: boolean;

  startArc(progress: readonly SectionProgress[]): void;
  advance(): void;
}

export const useSessionArcStore = create<SessionArcState>((set, get) => ({
  plan: undefined,
  currentIndex: 0,
  active: false,

  startArc(progress: readonly SectionProgress[]): void {
    const plan = buildSessionArc(progress, Math.random);
    set({ plan, currentIndex: 0, active: true });
  },

  advance(): void {
    const { plan, currentIndex } = get();
    if (!plan) return;
    const nextIndex = currentIndex + 1;
    if (nextIndex >= plan.length) {
      set({ plan: undefined, currentIndex: 0, active: false });
    } else {
      set({ currentIndex: nextIndex });
    }
  },
}));
