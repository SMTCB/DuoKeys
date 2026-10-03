import { describe, expect, it } from 'vitest';
import { classifyArticulation } from './articulation';

describe('classifyArticulation', () => {
  // TS-U-GRD-020
  it('classifies a note held near its written duration as even', () => {
    expect(classifyArticulation(500, 500)).toBe('even');
    expect(classifyArticulation(480, 500)).toBe('even'); // 0.96 ratio, inside the band
    expect(classifyArticulation(650, 500)).toBe('even'); // 1.3 ratio, inclusive boundary
  });

  // TS-U-GRD-020
  it('classifies a note held well under its written duration as short', () => {
    expect(classifyArticulation(300, 500)).toBe('short'); // 0.6 ratio
    expect(classifyArticulation(349, 500)).toBe('short'); // just under the 0.7 boundary
  });

  // TS-U-GRD-020
  it('classifies a note held well over its written duration as long', () => {
    expect(classifyArticulation(700, 500)).toBe('long'); // 1.4 ratio
    expect(classifyArticulation(651, 500)).toBe('long'); // just over the 1.3 boundary
  });

  // TS-U-GRD-021
  it('is unclassifiable when the target duration is zero or negative', () => {
    expect(classifyArticulation(500, 0)).toBeUndefined();
    expect(classifyArticulation(500, -10)).toBeUndefined();
  });
});
