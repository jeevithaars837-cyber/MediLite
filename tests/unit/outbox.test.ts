import { describe, it, expect } from 'vitest';

describe('Outbox Backoff and Retry Algorithm', () => {
  function computeBackoff(attempt: number): number {
    const base = Math.pow(2, attempt) * 2;
    const maxCap = 300; // 5 minutes
    return Math.min(maxCap, base);
  }

  it('calculates exponential delay correctly with 300s cap', () => {
    expect(computeBackoff(1)).toBe(4);
    expect(computeBackoff(2)).toBe(8);
    expect(computeBackoff(3)).toBe(16);
    expect(computeBackoff(8)).toBe(300); // capped at 300
    expect(computeBackoff(10)).toBe(300);
  });
});
