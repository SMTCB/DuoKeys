// US-1.07 — the remembered MIDI input (Profile.midiInputId). Pure helpers; the
// store that persists it lives in runtime/.

import type { Profile } from './types';

interface NamedInput {
  readonly id: string;
}

/** The remembered input first, so one tap reconnects; every other input keeps its order. */
export function rememberedInputFirst<T extends NamedInput>(inputs: readonly T[], rememberedId: string | undefined): T[] {
  if (rememberedId === undefined) return [...inputs];
  const remembered = inputs.filter((input) => input.id === rememberedId);
  const others = inputs.filter((input) => input.id !== rememberedId);
  return [...remembered, ...others];
}

/** A copy of the profile remembering `id`, or the same object when nothing changes. */
export function withMidiInput(profile: Profile, id: string): Profile {
  return profile.midiInputId === id ? profile : { ...profile, midiInputId: id };
}
