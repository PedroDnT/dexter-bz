import { describe, it, expect } from 'bun:test';
import { computeBrazilKeyRatioSeries } from '../tools/finance/key-ratios.js';

describe('Brazil key ratios computations', () => {
  it('computes growth, debt-to-equity, FCF per share, and ROIC', () => {
    const income = [
      {
        report_period: '2023-12-31',
        revenue: 1000,
        operating_income: 200,
        pretax_income: 180,
        income_tax_expense: 36,
      },
      {
        report_period: '2022-12-31',
        revenue: 800,
        operating_income: 160,
        pretax_income: 150,
        income_tax_expense: 30,
      },
    ];
    const balance = [
      {
        report_period: '2023-12-31',
        total_debt: 400,
        total_equity: 600,
        cash_and_equivalents: 100,
        outstanding_shares: 100,
      },
      {
        report_period: '2022-12-31',
        total_debt: 350,
        total_equity: 550,
        cash_and_equivalents: 80,
        outstanding_shares: 100,
      },
    ];
    const cashflow = [
      { report_period: '2023-12-31', free_cash_flow: 150 },
      { report_period: '2022-12-31', free_cash_flow: 100 },
    ];

    const series = computeBrazilKeyRatioSeries({ income, balance, cashflow, currency: 'BRL' });
    const latest = series[0] as Record<string, unknown>;

    expect(latest.revenue_growth).toBeCloseTo(0.25, 4);
    expect(latest.free_cash_flow_growth).toBeCloseTo(0.5, 4);
    expect(latest.debt_to_equity).toBeCloseTo(400 / 600, 4);
    expect(latest.free_cash_flow_per_share).toBeCloseTo(1.5, 4);
    expect(latest.return_on_invested_capital).toBeCloseTo(160 / 900, 4);
  });
});

