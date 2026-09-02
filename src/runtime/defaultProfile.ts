// Split out from sessionStore.ts so a Server Component can read the default
// profile (e.g. for a greeting) without transitively importing bootstrap.ts,
// which constructs browser-only adapters (WebAudioBackend opens a real
// AudioContext) at module-eval time — importing that into a Server Component
// crashes Next's server-side page-data collection (no AudioContext in Node).

import type { Profile } from '../core/profile/types';
import { asMidiPitch } from '../core/midi/decode';

// No profile-picker story in Sprint 1 (docs/03-SPRINT-PLAN.md) — one child
// profile stands in until US-2.x adds real profile management.
export const DEFAULT_PROFILE: Profile = {
  id: 'default-explorer',
  displayName: 'Explorer',
  role: 'explorer',
  keyboardRange: { low: asMidiPitch(21), high: asMidiPitch(108) },
  latencyOffsetMs: 0,
  toleranceScale: 1,
  avatar: '🎹',
};
