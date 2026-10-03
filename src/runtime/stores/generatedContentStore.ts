// TA-APP-005 — runtime home for sight-reading phrases (US-3.10). Generated
// at the moment the adult clicks "Generate" (TA-CNT-004: sight-reading is
// "Runtime", not build-time like Hanon) and never persisted — a fresh
// browser session or a page reload simply generates a new phrase, which
// matches FR-STU-010 ("never seen before") better than caching one would.

import { create } from 'zustand';
import type { Arrangement } from '../../core/content/types';

interface GeneratedContentState {
  arrangements: Map<string, Arrangement>;
  put(arrangement: Arrangement): void;
  get(id: string): Arrangement | undefined;
}

export const useGeneratedContentStore = create<GeneratedContentState>((set, get) => ({
  arrangements: new Map(),

  put(arrangement: Arrangement): void {
    set((state) => {
      const arrangements = new Map(state.arrangements);
      arrangements.set(arrangement.id, arrangement);
      return { arrangements };
    });
  },

  get(id: string): Arrangement | undefined {
    return get().arrangements.get(id);
  },
}));
