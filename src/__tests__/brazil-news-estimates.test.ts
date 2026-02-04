import { describe, it, expect } from 'bun:test';
import { filterNewsItemsByDate } from '../tools/finance/news.js';
import { normalizeYfinanceEstimates } from '../tools/finance/estimates.js';

describe('Brazil news filtering', () => {
  it('filters by start/end date using providerPublishTime', () => {
    const jan10 = Math.floor(new Date('2024-01-10T12:00:00Z').getTime() / 1000);
    const nov15 = Math.floor(new Date('2023-11-15T12:00:00Z').getTime() / 1000);
    const items = [
      { title: 'old', providerPublishTime: nov15 },
      { title: 'new', providerPublishTime: jan10 },
    ];

    const filtered = filterNewsItemsByDate(items, '2024-01-01', '2024-01-31');
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('new');
  });
});

describe('Brazil estimates normalization', () => {
  it('normalizes yfinance estimates payload', () => {
    const payload = {
      info: {
        targetMeanPrice: 30,
        targetHighPrice: 35,
        targetLowPrice: 25,
        recommendationMean: 2.1,
        recommendationKey: 'buy',
        numberOfAnalystOpinions: 12,
        forwardEps: 4.2,
        trailingEps: 3.8,
      },
    };

    const normalized = normalizeYfinanceEstimates(payload);
    expect((normalized.price_targets as { mean?: number }).mean).toBe(30);
    expect((normalized.recommendation as { key?: string }).key).toBe('buy');
    expect((normalized.eps as { forward?: number }).forward).toBe(4.2);
    expect(normalized.analyst_count).toBe(12);
  });
});

