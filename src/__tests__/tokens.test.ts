import { describe, it, expect } from 'bun:test';
import { estimateTokens, TOKEN_BUDGET } from '../utils/tokens.js';

describe('estimateTokens', () => {
  it('estimates tokens from text length', () => {
    // 35 chars / 3.5 = 10 tokens
    expect(estimateTokens('a'.repeat(35))).toBe(10);
  });

  it('rounds up (conservative estimate)', () => {
    // 10 chars / 3.5 = 2.857 → ceil = 3
    expect(estimateTokens('a'.repeat(10))).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles single character', () => {
    // 1 / 3.5 = 0.286 → ceil = 1
    expect(estimateTokens('x')).toBe(1);
  });

  it('handles long text', () => {
    const longText = 'x'.repeat(350000);
    expect(estimateTokens(longText)).toBe(100000);
  });

  it('handles JSON-like content', () => {
    const json = JSON.stringify({ key: 'value', nested: { arr: [1, 2, 3] } });
    const tokens = estimateTokens(json);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(Math.ceil(json.length / 3.5));
  });
});

describe('TOKEN_BUDGET', () => {
  it('is set to 150,000', () => {
    expect(TOKEN_BUDGET).toBe(150_000);
  });
});
