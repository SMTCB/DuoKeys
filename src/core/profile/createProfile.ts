// TA-DAT-004 — Profile factory. Role-based tolerance defaults per TA-MAT-006;
// keyboard range per ADR-009. Id is injected, never generated here (ADR-005).

import type { Profile } from './types';
import { asMidiPitch } from '../midi/decode';

const TOLERANCE_SCALE_BY_ROLE: Record<Profile['role'], number> = {
  explorer: 1.6,
  student: 1.0,
};

export interface CreateProfileInput {
  id: string;
  displayName: string;
  role: Profile['role'];
  avatar: string;
}

export function createProfile(input: CreateProfileInput): Profile {
  return {
    id: input.id,
    displayName: input.displayName,
    role: input.role,
    keyboardRange: { low: asMidiPitch(21), high: asMidiPitch(108) },
    latencyOffsetMs: 0,
    toleranceScale: TOLERANCE_SCALE_BY_ROLE[input.role],
    avatar: input.avatar,
  };
}
