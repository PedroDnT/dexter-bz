import { describe, it, expect } from 'bun:test';
import { computeFraudSignals } from '../pipelines/fraud/anomalies.js';
import type { FraudDataset } from '../pipelines/fraud/types.js';

function makeDataset(overrides: Partial<FraudDataset> = {}): FraudDataset {
  return {
    priceSnapshot: { price: 100, currency: 'USD' },
    prices: [{ date: '2025-01-01', close: 100 }],
    incomeStatements: [],
    balanceSheets: [],
    cashFlowStatements: [],
    filings: [{ id: '1' }],
    currency: 'USD',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Individual flag isolation tests
// ---------------------------------------------------------------------------

describe('computeFraudSignals – earnings_quality_cfo_negative', () => {
  it('triggers when NI > 0 and CFO < 0', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 100 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: -10 }],
      })
    );
    const flag = flags.find((f) => f.id === 'earnings_quality_cfo_negative');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
    expect(flag!.evidence?.net_income).toBe(100);
    expect(flag!.evidence?.net_cash_flow_from_operations).toBe(-10);
  });

  it('does NOT trigger when NI <= 0', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: -50 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: -10 }],
      })
    );
    expect(flags.find((f) => f.id === 'earnings_quality_cfo_negative')).toBeUndefined();
  });

  it('does NOT trigger when CFO >= 0', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 100 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 10 }],
      })
    );
    expect(flags.find((f) => f.id === 'earnings_quality_cfo_negative')).toBeUndefined();
  });
});

describe('computeFraudSignals – earnings_quality_low_cfo', () => {
  it('triggers when CFO/NI < 0.6 and both positive', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 200 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 80 }],
      })
    );
    const flag = flags.find((f) => f.id === 'earnings_quality_low_cfo');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('does NOT trigger when CFO/NI >= 0.6', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 100 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 80 }],
      })
    );
    expect(flags.find((f) => f.id === 'earnings_quality_low_cfo')).toBeUndefined();
  });

  it('does NOT trigger when NI is zero (avoids division by zero)', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 0 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 50 }],
      })
    );
    expect(flags.find((f) => f.id === 'earnings_quality_low_cfo')).toBeUndefined();
  });
});

describe('computeFraudSignals – accruals_high', () => {
  it('triggers medium when accrual ratio > 0.1 but <= 0.2', () => {
    // accrual = (NI - CFO) / Assets = (200 - 50) / 1000 = 0.15
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 200 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 50 }],
        balanceSheets: [{ report_period: '2025-12-31', total_assets: 1000 }],
      })
    );
    const flag = flags.find((f) => f.id === 'accruals_high');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('triggers high when accrual ratio > 0.2', () => {
    // accrual = (300 - 50) / 1000 = 0.25
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 300 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 50 }],
        balanceSheets: [{ report_period: '2025-12-31', total_assets: 1000 }],
      })
    );
    const flag = flags.find((f) => f.id === 'accruals_high');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
  });

  it('does NOT trigger when accrual ratio <= 0.1', () => {
    // accrual = (100 - 50) / 1000 = 0.05
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 100 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 50 }],
        balanceSheets: [{ report_period: '2025-12-31', total_assets: 1000 }],
      })
    );
    expect(flags.find((f) => f.id === 'accruals_high')).toBeUndefined();
  });

  it('does NOT trigger when total_assets is zero', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 200 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 50 }],
        balanceSheets: [{ report_period: '2025-12-31', total_assets: 0 }],
      })
    );
    expect(flags.find((f) => f.id === 'accruals_high')).toBeUndefined();
  });
});

describe('computeFraudSignals – receivables_outpacing_revenue', () => {
  it('triggers medium when delta > 0.25 but <= 0.5', () => {
    // revenue growth = (1000 - 800) / 800 = 0.25
    // receivables growth = (500 - 200) / 200 = 1.5
    // delta = 1.5 - 0.25 = 1.25 (> 0.5 → actually high)
    // Let's use tighter numbers:
    // revenue growth = 0.1, receivables growth = 0.5 → delta = 0.4
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1100 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
        balanceSheets: [
          { report_period: '2025-12-31', accounts_receivable: 150 },
          { report_period: '2024-12-31', accounts_receivable: 100 },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'receivables_outpacing_revenue');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('triggers high when delta > 0.5', () => {
    // revenue growth = (1050 - 1000) / 1000 = 0.05
    // receivables growth = (200 - 100) / 100 = 1.0
    // delta = 1.0 - 0.05 = 0.95
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1050 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
        balanceSheets: [
          { report_period: '2025-12-31', accounts_receivable: 200 },
          { report_period: '2024-12-31', accounts_receivable: 100 },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'receivables_outpacing_revenue');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('high');
  });

  it('does NOT trigger when delta <= 0.25', () => {
    // revenue growth = 0.1, receivables growth = 0.2 → delta = 0.1
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1100 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
        balanceSheets: [
          { report_period: '2025-12-31', accounts_receivable: 120 },
          { report_period: '2024-12-31', accounts_receivable: 100 },
        ],
      })
    );
    expect(flags.find((f) => f.id === 'receivables_outpacing_revenue')).toBeUndefined();
  });
});

describe('computeFraudSignals – balance_sheet_identity_mismatch', () => {
  it('triggers low when mismatch > 2% but <= 5%', () => {
    // diff = 1000 - (550 + 420) = 30, rel = 30/1000 = 0.03
    const { flags } = computeFraudSignals(
      makeDataset({
        balanceSheets: [
          {
            report_period: '2025-12-31',
            total_assets: 1000,
            total_liabilities: 550,
            total_shareholder_equity: 420,
          },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'balance_sheet_identity_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('low');
  });

  it('triggers medium when mismatch > 5%', () => {
    // diff = 1000 - (500 + 430) = 70, rel = 70/1000 = 0.07
    const { flags } = computeFraudSignals(
      makeDataset({
        balanceSheets: [
          {
            report_period: '2025-12-31',
            total_assets: 1000,
            total_liabilities: 500,
            total_shareholder_equity: 430,
          },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'balance_sheet_identity_mismatch');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('does NOT trigger when identity holds within 2%', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        balanceSheets: [
          {
            report_period: '2025-12-31',
            total_assets: 1000,
            total_liabilities: 600,
            total_shareholder_equity: 400,
          },
        ],
      })
    );
    expect(flags.find((f) => f.id === 'balance_sheet_identity_mismatch')).toBeUndefined();
  });
});

describe('computeFraudSignals – revenue_swing', () => {
  it('triggers low when |growth| > 30% but <= 60%', () => {
    // growth = (1400 - 1000) / 1000 = 0.4
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1400 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'revenue_swing');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('low');
  });

  it('triggers medium when |growth| > 60%', () => {
    // growth = (1700 - 1000) / 1000 = 0.7
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1700 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
      })
    );
    const flag = flags.find((f) => f.id === 'revenue_swing');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('also triggers on negative swing (revenue decline)', () => {
    // growth = (600 - 1000) / 1000 = -0.4
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 600 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
      })
    );
    expect(flags.find((f) => f.id === 'revenue_swing')).toBeDefined();
  });

  it('does NOT trigger when |growth| <= 30%', () => {
    // growth = (1200 - 1000) / 1000 = 0.2
    const { flags } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1200 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
      })
    );
    expect(flags.find((f) => f.id === 'revenue_swing')).toBeUndefined();
  });
});

describe('computeFraudSignals – filings_missing', () => {
  it('triggers when filings array is empty', () => {
    const { flags } = computeFraudSignals(makeDataset({ filings: [] }));
    expect(flags.find((f) => f.id === 'filings_missing')).toBeDefined();
  });

  it('does NOT trigger when filings are present', () => {
    const { flags } = computeFraudSignals(makeDataset({ filings: [{ id: '1' }] }));
    expect(flags.find((f) => f.id === 'filings_missing')).toBeUndefined();
  });

  it('triggers when filings is undefined', () => {
    const { flags } = computeFraudSignals(makeDataset({ filings: undefined }));
    expect(flags.find((f) => f.id === 'filings_missing')).toBeDefined();
  });
});

describe('computeFraudSignals – data_coverage_gaps', () => {
  it('triggers low when 1-2 inputs missing', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        priceSnapshot: undefined,
        // Keep other arrays populated to avoid counting more than 1 missing
        prices: [{ close: 10 }],
        incomeStatements: [{ revenue: 1000 }],
        balanceSheets: [{ total_assets: 500 }],
        cashFlowStatements: [{ net_cash_flow_from_operations: 100 }],
      })
    );
    const flag = flags.find((f) => f.id === 'data_coverage_gaps');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('low');
  });

  it('triggers medium when 3+ inputs missing', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        priceSnapshot: undefined,
        prices: undefined,
        incomeStatements: undefined,
      })
    );
    const flag = flags.find((f) => f.id === 'data_coverage_gaps');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('medium');
  });

  it('does NOT trigger when all inputs present', () => {
    const { flags } = computeFraudSignals(
      makeDataset({
        priceSnapshot: { price: 10 },
        prices: [{ close: 10 }],
        incomeStatements: [{ revenue: 1000 }],
        balanceSheets: [{ total_assets: 500 }],
        cashFlowStatements: [{ net_cash_flow_from_operations: 100 }],
      })
    );
    expect(flags.find((f) => f.id === 'data_coverage_gaps')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

describe('computeFraudSignals – metrics', () => {
  it('computes YoY growth metrics correctly', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1200, net_income: 150 },
          { report_period: '2024-12-31', revenue: 1000, net_income: 100 },
        ],
        cashFlowStatements: [
          { report_period: '2025-12-31', net_cash_flow_from_operations: 180, free_cash_flow: 120 },
          { report_period: '2024-12-31', net_cash_flow_from_operations: 150, free_cash_flow: 100 },
        ],
      })
    );
    expect(metrics.revenue_yoy_growth).toBeCloseTo(0.2);
    expect(metrics.net_income_yoy_growth).toBeCloseTo(0.5);
    expect(metrics.cfo_yoy_growth).toBeCloseTo(0.2);
    expect(metrics.fcf_yoy_growth).toBeCloseTo(0.2);
  });

  it('computes cfo_to_net_income ratio', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 100 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 80 }],
      })
    );
    expect(metrics.cfo_to_net_income).toBeCloseTo(0.8);
  });

  it('computes accrual_ratio', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', net_income: 200 }],
        cashFlowStatements: [{ report_period: '2025-12-31', net_cash_flow_from_operations: 100 }],
        balanceSheets: [{ report_period: '2025-12-31', total_assets: 2000 }],
      })
    );
    // (200 - 100) / 2000 = 0.05
    expect(metrics.accrual_ratio).toBeCloseTo(0.05);
  });

  it('sets latest_report_period from income statements', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1000 },
          { report_period: '2024-12-31', revenue: 800 },
        ],
      })
    );
    expect(metrics.latest_report_period).toBe('2025-12-31');
  });

  it('tracks filings_count', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({ filings: [{ id: '1' }, { id: '2' }, { id: '3' }] })
    );
    expect(metrics.filings_count).toBe(3);
  });

  it('tracks missing_inputs', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        priceSnapshot: undefined,
        incomeStatements: [],
      })
    );
    const missing = metrics.missing_inputs as string[];
    expect(missing).toContain('price_snapshot');
    expect(missing).toContain('income_statements');
  });
});

// ---------------------------------------------------------------------------
// Alternative field name lookups
// ---------------------------------------------------------------------------

describe('computeFraudSignals – alternative field names', () => {
  it('picks totalRevenue as fallback for revenue', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', totalRevenue: 5000 }],
      })
    );
    expect(metrics.revenue).toBe(5000);
  });

  it('picks netIncome as fallback for net_income', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', netIncome: 300 }],
      })
    );
    expect(metrics.net_income).toBe(300);
  });

  it('picks operating_cash_flow as fallback', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        cashFlowStatements: [{ report_period: '2025-12-31', operating_cash_flow: 150 }],
      })
    );
    expect(metrics.net_cash_flow_from_operations).toBe(150);
  });

  it('picks net_receivables as fallback for accounts_receivable', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1100 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
        balanceSheets: [
          { report_period: '2025-12-31', net_receivables: 200 },
          { report_period: '2024-12-31', net_receivables: 100 },
        ],
      })
    );
    expect(metrics.receivables_yoy_growth).toBeCloseTo(1.0);
  });

  it('picks total_equity_gross_minority_interest for equity', () => {
    const { flags, metrics } = computeFraudSignals(
      makeDataset({
        balanceSheets: [
          {
            report_period: '2025-12-31',
            total_assets: 1000,
            total_liabilities: 600,
            total_equity_gross_minority_interest: 400,
          },
        ],
      })
    );
    expect(metrics.balance_sheet_identity_diff).toBe(0);
    expect(flags.find((f) => f.id === 'balance_sheet_identity_mismatch')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('computeFraudSignals – edge cases', () => {
  it('returns empty flags for completely empty dataset', () => {
    const { flags, metrics } = computeFraudSignals({});
    // Should only have filings_missing and data_coverage_gaps
    expect(flags.find((f) => f.id === 'filings_missing')).toBeDefined();
    expect(flags.find((f) => f.id === 'data_coverage_gaps')).toBeDefined();
    expect(flags.length).toBe(2);
    expect(metrics.filings_count).toBe(0);
  });

  it('handles string numbers in fields', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', revenue: '5000' }],
      })
    );
    expect(metrics.revenue).toBe(5000);
  });

  it('ignores non-finite numbers', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', revenue: Infinity }],
      })
    );
    expect(metrics.revenue).toBeUndefined();
  });

  it('ignores NaN values', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', revenue: NaN }],
      })
    );
    expect(metrics.revenue).toBeUndefined();
  });

  it('handles null fields gracefully', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', revenue: null }],
      })
    );
    expect(metrics.revenue).toBeUndefined();
  });

  it('sorts statements by report_period descending', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2023-12-31', revenue: 800 },
          { report_period: '2025-12-31', revenue: 1200 },
          { report_period: '2024-12-31', revenue: 1000 },
        ],
      })
    );
    // latest should be 2025, prev should be 2024
    expect(metrics.revenue).toBe(1200);
    expect(metrics.revenue_yoy_growth).toBeCloseTo(0.2);
  });

  it('growth is null when prior is zero (division by zero)', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [
          { report_period: '2025-12-31', revenue: 1000 },
          { report_period: '2024-12-31', revenue: 0 },
        ],
      })
    );
    expect(metrics.revenue_yoy_growth).toBeUndefined();
  });

  it('growth is null with only one period', () => {
    const { metrics } = computeFraudSignals(
      makeDataset({
        incomeStatements: [{ report_period: '2025-12-31', revenue: 1000 }],
      })
    );
    expect(metrics.revenue_yoy_growth).toBeUndefined();
  });
});
