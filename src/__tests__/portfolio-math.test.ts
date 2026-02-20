import { describe, it, expect } from 'bun:test';
import {
  normalizeWeights,
  computeSimpleReturns,
  computeCumulativeReturns,
  annualizeReturn,
  annualizeVolatility,
  computeSharpe,
  computeMaxDrawdown,
  summarizeSeries,
} from '../tools/finance/portfolio-math.js';
import { type ReturnFrequency, type RiskFreeSpec } from '../tools/finance/portfolio-types.js';

const DAILY: ReturnFrequency = 'daily';

const DEFAULT_RF: RiskFreeSpec = { type: 'constant', value_annual: 0.04 };

describe('portfolio-math helpers', () => {
  it('normalizes weights to sum to 1', () => {
    const w = normalizeWeights([1, 1, 2]);
    const sum = w.reduce((s, x) => s + x, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(w[0]).toBeCloseTo(0.25, 10);
    expect(w[2]).toBeCloseTo(0.5, 10);
  });

  it('computes simple returns from prices', () => {
    const prices = { dates: ['2024-01-01', '2024-01-02', '2024-01-03'], values: [100, 110, 121] };
    const r = computeSimpleReturns(prices);
    expect(r.dates).toEqual(['2024-01-02', '2024-01-03']);
    expect(r.values.length).toBe(2);
    expect(r.values[0]).toBeCloseTo(0.1, 10);
    expect(r.values[1]).toBeCloseTo(0.1, 10);
  });

  it('computes cumulative returns correctly', () => {
    const returns = { dates: ['2024-01-02', '2024-01-03'], values: [0.1, 0.1] };
    const cum = computeCumulativeReturns(returns);
    expect(cum.values[0]).toBeCloseTo(0.1, 10);
    expect(cum.values[1]).toBeCloseTo(0.21, 10);
  });

  it('annualizes return for daily series', () => {
    const dailyReturn = 0.001; // 0.1% per day
    const returns = {
      dates: Array.from({ length: 252 }, (_, i) => `2024-01-${(i + 1).toString().padStart(2, '0')}`),
      values: Array(252).fill(dailyReturn),
    };
    const ann = annualizeReturn(returns, DAILY);
    // Approx (1 + 0.001)^252 - 1
    const expected = Math.pow(1 + dailyReturn, 252) - 1;
    expect(ann).not.toBeNull();
    expect(ann!).toBeCloseTo(expected, 6);
  });

  it('annualizes volatility for daily series', () => {
    const returns = {
      dates: ['2024-01-01', '2024-01-02', '2024-01-03'],
      values: [0.01, -0.01, 0.01],
    };
    const vol = annualizeVolatility(returns, DAILY);
    expect(vol).not.toBeNull();
    expect(vol!).toBeGreaterThan(0);
  });

  it('computes Sharpe ratio with constant risk-free', () => {
    const returns = {
      dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'],
      values: [0.005, 0.004, 0.006, 0.005],
    };
    const sharpe = computeSharpe(returns, DAILY, DEFAULT_RF);
    expect(sharpe).not.toBeNull();
    expect(sharpe!).toBeGreaterThan(0);
  });

  it('computes max drawdown', () => {
    const returns = {
      dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'],
      values: [0.1, -0.2, 0.05, 0.02],
    };
    const cum = computeCumulativeReturns(returns);
    const dd = computeMaxDrawdown(cum);
    expect(dd).not.toBeNull();
    expect(dd!).toBeLessThan(0);
  });

  it('summarizes series into portfolio metrics', () => {
    const returns = {
      dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'],
      values: [0.01, 0.0, -0.005, 0.002],
    };
    const summary = summarizeSeries(returns, DAILY, DEFAULT_RF);
    expect(summary.annualized_return).not.toBeNull();
    expect(summary.annualized_volatility).not.toBeNull();
    expect(summary.max_drawdown).not.toBeNull();
  });
});
