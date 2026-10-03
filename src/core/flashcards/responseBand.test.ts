import { describe, expect, it } from 'vitest';
import { classifyResponse, FAST_THRESHOLD_SECONDS, HINT_THRESHOLD_SECONDS } from './responseBand';

// TS-U-GRD-013
describe('classifyResponse', () => {
  it('classifies under 2s as fast', () => {
    expect(classifyResponse(0)).toBe('fast');
    expect(classifyResponse(1.99)).toBe('fast');
  });

  it('classifies the 2s..6s window as correct, inclusive of both boundaries', () => {
    expect(classifyResponse(FAST_THRESHOLD_SECONDS)).toBe('correct');
    expect(classifyResponse(4)).toBe('correct');
    expect(classifyResponse(HINT_THRESHOLD_SECONDS)).toBe('correct');
  });

  it('classifies beyond 6s as hinted, and still not a failure', () => {
    expect(classifyResponse(6.01)).toBe('hinted');
    expect(classifyResponse(60)).toBe('hinted');
  });
});
