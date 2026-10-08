// TS-U-SYN-010 — the household username is wrapped in a mail-proof address and shown back plainly.
import { describe, expect, it } from 'vitest';
import { displayName, householdEmail, householdPassword } from './supabaseBackend';

describe('household login (TS-U-SYN-010)', () => {
  it('turns a username into one stable address, ignoring case and spaces', () => {
    expect(householdEmail('  The Smiths ')).toBe('thesmiths@household.duokeys');
    expect(householdEmail('thesmiths')).toBe(householdEmail('TheSmiths'));
  });
  it('pads a short PIN to a password Supabase accepts', () => {
    expect(householdPassword(' 1234 ')).toBe('duokeys-1234');
    expect(householdPassword('1234').length).toBeGreaterThanOrEqual(6);
  });
  it('shows the username back, and leaves a real email alone', () => {
    expect(displayName('thesmiths@household.duokeys')).toBe('thesmiths');
    expect(displayName('parent@example.com')).toBe('parent@example.com');
  });
});
