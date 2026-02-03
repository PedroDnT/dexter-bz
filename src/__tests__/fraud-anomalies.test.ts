import { describe, it, expect } from 'bun:test';
import { computeFraudSignals } from '../pipelines/fraud/anomalies.js';

describe('fraud anomaly heuristics', () => {
  it('flags negative CFO with positive earnings, high accruals, and receivables outpacing revenue', () => {
    const { flags, metrics } = computeFraudSignals({
      priceSnapshot: { price: 10, currency: 'USD' },
      prices: [{ date: '2025-01-01', close: 10 }],
      incomeStatements: [
        { report_period: '2025-12-31', revenue: 1000, net_income: 200 },
        { report_period: '2024-12-31', revenue: 800, net_income: 180 },
      ],
      cashFlowStatements: [
        { report_period: '2025-12-31', net_cash_flow_from_operations: -50, free_cash_flow: -80 },
        { report_period: '2024-12-31', net_cash_flow_from_operations: 120, free_cash_flow: 90 },
      ],
      balanceSheets: [
        {
          report_period: '2025-12-31',
          total_assets: 1000,
          total_liabilities: 600,
          total_shareholder_equity: 400,
          accounts_receivable: 300,
        },
        { report_period: '2024-12-31', total_assets: 900, accounts_receivable: 100 },
      ],
      filings: [],
      currency: 'USD',
    });

    expect(flags.some((f) => f.id === 'earnings_quality_cfo_negative')).toBe(true);
    expect(flags.some((f) => f.id === 'accruals_high')).toBe(true);
    expect(flags.some((f) => f.id === 'receivables_outpacing_revenue')).toBe(true);
    expect(flags.some((f) => f.id === 'filings_missing')).toBe(true);

    expect(typeof metrics.cfo_to_net_income).toBe('number');
    expect(typeof metrics.accrual_ratio).toBe('number');
  });
});

