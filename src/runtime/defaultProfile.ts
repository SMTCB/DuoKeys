// Split out from sessionStore.ts so a Server Component can read the default
// profile (e.g. for a greeting) without transitively importing bootstrap.ts,
// which constructs browser-only adapters (WebAudioBackend opens a real
// AudioContext) at module-eval time — importing that into a Server Component
// crashes Next's server-side page-data collection (no AudioContext in Node).

import type { Profile } from '../core/profile/types';
import { asMidiPitch } from '../core/midi/decode';

// sessionStore's initial value before a family profile is chosen at `/`
// (US-2.01) — never written to storage itself, just the in-memory fallback
// until profileStore.selectProfile()/addProfile() calls setProfile().
export const DEFAULT_PROFILE: Profile = {
  id: 'default-explorer',
  displayName: 'Explorer',
  role: 'explorer',
  keyboardRange: { low: asMidiPitch(21), high: asMidiPitch(108) },
  latencyOffsetMs: 0,
  toleranceScale: 1.6, // TA-MAT-006 / FR-EXP-007 — child default
  avatar: '🎹',
};
