import { describe, expect, it } from 'vitest';
import { windowFor } from './tolerance';

describe('windowFor', () => {
  // TS-U-MAT-016
  it('is wider at 60 bpm than at 160 bpm', () => {
    expect(windowFor('loose', 60)).toBeGreaterThan(windowFor('loose', 160));
  });

  // TS-U-MAT-017
  it('never drops below the absolute floor at very high tempo', () => {
    expect(windowFor('perfect', 300)).toBe(45);
    expect(windowFor('good', 300)).toBe(90);
    expect(windowFor('loose', 300)).toBe(160);
  });
});
