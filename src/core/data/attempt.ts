// TA-DAT-002 — Attempt record. Kept verbatim against
// docs/01-TECHNICAL-ARCHITECTURE.md (CLAUDE.md § 1.2) — if you change this
// shape, change it there too.
//
// Attempts are append-only and immutable (TA-DAT-002) — there is deliberately
// no update path here, only construction.

import type { Grade, NoteResult } from '../grade/grade';

export interface Attempt {
  id: string; // uuid, client-generated
  profileId: string;
  arrangementId: string;
  sectionId?: string;
  startedAt: string; // ISO
  durationMs: number;
  mode: 'wait' | 'timed';
  tempoScale: number;
  grade: Grade;
  events: NoteResult[]; // embedded, not a separate table
  appVersion: string;
}

export interface ComputeAttemptInput {
  id: string;
  profileId: string;
  arrangementId: string;
  sectionId?: string;
  startedAtIso: string;
  durationMs: number;
  mode: 'wait' | 'timed';
  tempoScale: number;
  grade: Grade;
  appVersion: string;
}

/** ADR-005: no Date.now()/crypto.randomUUID() here — id and startedAtIso are injected. */
export function computeAttempt(input: ComputeAttemptInput): Attempt {
  const attempt: Attempt = {
    id: input.id,
    profileId: input.profileId,
    arrangementId: input.arrangementId,
    startedAt: input.startedAtIso,
    durationMs: input.durationMs,
    mode: input.mode,
    tempoScale: input.tempoScale,
    grade: input.grade,
    events: [...input.grade.perNote],
    appVersion: input.appVersion,
  };
  return input.sectionId === undefined ? attempt : { ...attempt, sectionId: input.sectionId };
}
