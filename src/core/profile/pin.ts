// FR-PRO-001 — a family member's PIN. A door-latch for a shared screen, not security: it is a
// four-digit string kept on the profile's settings record (so it syncs with no table of its
// own) and compared as typed.

export const PIN_LENGTH = 4;

export const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin);

/** Reads the PIN off a settings record; undefined when none was set (or it is malformed). */
export function pinOf(settings: unknown): string | undefined {
  const raw = (settings as { pin?: unknown } | undefined)?.pin;
  return typeof raw === 'string' && isValidPin(raw) ? raw : undefined;
}

/** A member with no PIN set lets anyone in; otherwise the typed digits must match. */
export const isPinCorrect = (settings: unknown, typed: string): boolean => {
  const pin = pinOf(settings);
  return pin === undefined || pin === typed;
};
