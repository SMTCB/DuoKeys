// TS-U-PRO-010 — the family PIN: four digits, read off settings, compared as typed.
import { describe, expect, it } from 'vitest';
import { isPinCorrect, isValidPin, pinOf } from './pin';

describe('family PIN (TS-U-PRO-010)', () => {
  it('accepts exactly four digits', () => {
    expect(isValidPin('1234')).toBe(true);
    for (const bad of ['', '123', '12345', 'abcd', '12 4']) expect(isValidPin(bad)).toBe(false);
  });
  it('reads the PIN from settings and ignores anything malformed', () => {
    expect(pinOf({ pin: '0420' })).toBe('0420');
    expect(pinOf({ pin: 42 })).toBeUndefined();
    expect(pinOf(undefined)).toBeUndefined();
  });
  it('lets a member with no PIN in, and checks the digits otherwise', () => {
    expect(isPinCorrect({}, '')).toBe(true);
    expect(isPinCorrect({ pin: '1234' }, '1234')).toBe(true);
    expect(isPinCorrect({ pin: '1234' }, '1235')).toBe(false);
  });
});
