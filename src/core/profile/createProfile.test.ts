import { describe, expect, it } from 'vitest';
import { createProfile } from './createProfile';

describe('createProfile', () => {
  // TS-U-DAT-001
  it('defaults the explorer role to toleranceScale 1.6', () => {
    const profile = createProfile({ id: '1', displayName: 'Mira', role: 'explorer', avatar: '🐣' });
    expect(profile.toleranceScale).toBe(1.6);
  });

  // TS-U-DAT-002
  it('defaults the student role to toleranceScale 1.0', () => {
    const profile = createProfile({ id: '2', displayName: 'Dana', role: 'student', avatar: '🎹' });
    expect(profile.toleranceScale).toBe(1.0);
  });

  it('sets the full 21-108 keyboard range and zero latency offset', () => {
    const profile = createProfile({ id: '3', displayName: 'Sam', role: 'explorer', avatar: '🦊' });
    expect(profile.keyboardRange.low).toBe(21);
    expect(profile.keyboardRange.high).toBe(108);
    expect(profile.latencyOffsetMs).toBe(0);
  });

  it('carries the given id, displayName and avatar through unchanged', () => {
    const profile = createProfile({ id: 'abc-123', displayName: 'Leo', role: 'student', avatar: '🐢' });
    expect(profile.id).toBe('abc-123');
    expect(profile.displayName).toBe('Leo');
    expect(profile.avatar).toBe('🐢');
  });
});
