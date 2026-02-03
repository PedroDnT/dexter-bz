import type { FraudDataset, FraudFlag, FraudMetrics, FlagSeverity } from './types.js';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickNumber(record: Record<string, unknown> | undefined, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const n = toNumber(record[key]);
    if (n !== null) return n;
  }
  return null;
}

function pickString(record: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function sortByReportPeriodDesc(records: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return [...records].sort((a, b) => {
    const da = new Date((a.report_period as string) || 0).getTime();
    const db = new Date((b.report_period as string) || 0).getTime();
    return db - da;
  });
}

function safeGrowth(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(prior) || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

function addFlag(
  flags: FraudFlag[],
  id: string,
  severity: FlagSeverity,
  title: string,
  detail: string,
  evidence?: Record<string, unknown>
): void {
  flags.push({ id, severity, title, detail, evidence });
}

export function computeFraudSignals(dataset: FraudDataset): { flags: FraudFlag[]; metrics: FraudMetrics } {
  const flags: FraudFlag[] = [];
  const metrics: FraudMetrics = {};

  const income = dataset.incomeStatements ? sortByReportPeriodDesc(dataset.incomeStatements) : [];
  const balance = dataset.balanceSheets ? sortByReportPeriodDesc(dataset.balanceSheets) : [];
  const cashflow = dataset.cashFlowStatements ? sortByReportPeriodDesc(dataset.cashFlowStatements) : [];

  const incomeLatest = income[0];
  const incomePrev = income[1];
  const balanceLatest = balance[0];
  const balancePrev = balance[1];
  const cashflowLatest = cashflow[0];
  const cashflowPrev = cashflow[1];

  const latestPeriod =
    pickString(incomeLatest, ['report_period']) ||
    pickString(cashflowLatest, ['report_period']) ||
    pickString(balanceLatest, ['report_period']);
  if (latestPeriod) metrics.latest_report_period = latestPeriod;

  const revenue = pickNumber(incomeLatest, ['revenue', 'total_revenue', 'totalRevenue']);
  const revenuePrev = pickNumber(incomePrev, ['revenue', 'total_revenue', 'totalRevenue']);
  const netIncome = pickNumber(incomeLatest, ['net_income', 'netIncome', 'net_income_common_stockholders']);
  const netIncomePrev = pickNumber(incomePrev, ['net_income', 'netIncome', 'net_income_common_stockholders']);
  const cfo = pickNumber(cashflowLatest, [
    'net_cash_flow_from_operations',
    'operating_cash_flow',
    'total_cash_from_operating_activities',
  ]);
  const cfoPrev = pickNumber(cashflowPrev, [
    'net_cash_flow_from_operations',
    'operating_cash_flow',
    'total_cash_from_operating_activities',
  ]);

  const fcf = pickNumber(cashflowLatest, ['free_cash_flow', 'freeCashFlow']);
  const fcfPrev = pickNumber(cashflowPrev, ['free_cash_flow', 'freeCashFlow']);

  if (revenue !== null) metrics.revenue = revenue;
  if (netIncome !== null) metrics.net_income = netIncome;
  if (cfo !== null) metrics.net_cash_flow_from_operations = cfo;
  if (fcf !== null) metrics.free_cash_flow = fcf;

  const revenueGrowth = safeGrowth(revenue, revenuePrev);
  if (revenueGrowth !== null) metrics.revenue_yoy_growth = revenueGrowth;

  const netIncomeGrowth = safeGrowth(netIncome, netIncomePrev);
  if (netIncomeGrowth !== null) metrics.net_income_yoy_growth = netIncomeGrowth;

  const cfoGrowth = safeGrowth(cfo, cfoPrev);
  if (cfoGrowth !== null) metrics.cfo_yoy_growth = cfoGrowth;

  const fcfGrowth = safeGrowth(fcf, fcfPrev);
  if (fcfGrowth !== null) metrics.fcf_yoy_growth = fcfGrowth;

  // Earnings quality: CFO vs Net Income
  if (netIncome !== null && cfo !== null) {
    const ratio = netIncome === 0 ? null : cfo / netIncome;
    if (ratio !== null && Number.isFinite(ratio)) {
      metrics.cfo_to_net_income = ratio;
    }

    if (netIncome > 0 && cfo < 0) {
      addFlag(
        flags,
        'earnings_quality_cfo_negative',
        'high',
        'Positive earnings but negative operating cash flow',
        'Latest period shows positive net income while operating cash flow is negative. This can indicate aggressive revenue recognition, working-capital distortions, or other earnings-quality issues.',
        { net_income: netIncome, net_cash_flow_from_operations: cfo, report_period: latestPeriod ?? null }
      );
    } else if (netIncome > 0 && ratio !== null && ratio < 0.6) {
      addFlag(
        flags,
        'earnings_quality_low_cfo',
        'medium',
        'Operating cash flow lags net income',
        'Operating cash flow is materially lower than net income in the latest period. This can be a working-capital signal and warrants checking receivables, payables, and one-off items.',
        { cfo_to_net_income: ratio, net_income: netIncome, net_cash_flow_from_operations: cfo, report_period: latestPeriod ?? null }
      );
    }
  }

  // Accruals: (NI - CFO) / Total Assets
  const totalAssets = pickNumber(balanceLatest, ['total_assets', 'totalAssets']);
  if (netIncome !== null && cfo !== null && totalAssets !== null && totalAssets !== 0) {
    const accrual = (netIncome - cfo) / totalAssets;
    metrics.accrual_ratio = accrual;
    if (accrual > 0.1) {
      addFlag(
        flags,
        'accruals_high',
        accrual > 0.2 ? 'high' : 'medium',
        'High accrual ratio',
        'Accruals (net income minus operating cash flow) are high relative to total assets. Higher accruals can be associated with lower earnings quality.',
        { accrual_ratio: accrual, net_income: netIncome, net_cash_flow_from_operations: cfo, total_assets: totalAssets, report_period: latestPeriod ?? null }
      );
    }
  }

  // Receivables vs Revenue growth
  const receivables = pickNumber(balanceLatest, [
    'accounts_receivable',
    'accounts_receivable_net',
    'net_receivables',
    'trade_receivables',
  ]);
  const receivablesPrev = pickNumber(balancePrev, [
    'accounts_receivable',
    'accounts_receivable_net',
    'net_receivables',
    'trade_receivables',
  ]);
  const receivablesGrowth = safeGrowth(receivables, receivablesPrev);
  if (receivablesGrowth !== null) metrics.receivables_yoy_growth = receivablesGrowth;

  if (revenueGrowth !== null && receivablesGrowth !== null) {
    const delta = receivablesGrowth - revenueGrowth;
    metrics.receivables_minus_revenue_growth = delta;
    if (delta > 0.25) {
      addFlag(
        flags,
        'receivables_outpacing_revenue',
        delta > 0.5 ? 'high' : 'medium',
        'Receivables growing faster than revenue',
        'Receivables growth materially exceeds revenue growth. This can indicate looser credit terms, collection issues, or potential revenue recognition concerns.',
        { revenue_yoy_growth: revenueGrowth, receivables_yoy_growth: receivablesGrowth, delta, report_period: latestPeriod ?? null }
      );
    }
  }

  // Balance sheet equation check: Assets ≈ Liabilities + Equity
  const totalLiabilities = pickNumber(balanceLatest, ['total_liabilities', 'totalLiabilities']);
  const totalEquity = pickNumber(balanceLatest, [
    'total_shareholder_equity',
    'total_stockholder_equity',
    'total_equity_gross_minority_interest',
    'totalEquityGrossMinorityInterest',
  ]);
  if (totalAssets !== null && totalLiabilities !== null && totalEquity !== null) {
    const diff = totalAssets - (totalLiabilities + totalEquity);
    const rel = totalAssets === 0 ? 0 : Math.abs(diff) / Math.abs(totalAssets);
    metrics.balance_sheet_identity_diff = diff;
    metrics.balance_sheet_identity_rel = rel;
    if (rel > 0.02) {
      addFlag(
        flags,
        'balance_sheet_identity_mismatch',
        rel > 0.05 ? 'medium' : 'low',
        'Balance sheet identity mismatch',
        'Total assets differ materially from total liabilities plus equity. This may be a data mapping issue, rounding, or a reporting classification difference, but should be checked.',
        { total_assets: totalAssets, total_liabilities: totalLiabilities, total_equity: totalEquity, diff, rel, report_period: latestPeriod ?? null }
      );
    }
  }

  // Revenue swing
  if (revenueGrowth !== null && Math.abs(revenueGrowth) > 0.3) {
    addFlag(
      flags,
      'revenue_swing',
      Math.abs(revenueGrowth) > 0.6 ? 'medium' : 'low',
      'Large year-over-year revenue change',
      'Revenue changed significantly year-over-year. Large swings can be legitimate (M&A, cyclicality), but should be reconciled with filings and segment disclosures.',
      { revenue_yoy_growth: revenueGrowth, report_period: latestPeriod ?? null }
    );
  }

  // Filings coverage
  const filingsCount = dataset.filings?.length ?? 0;
  metrics.filings_count = filingsCount;
  if (filingsCount === 0) {
    addFlag(
      flags,
      'filings_missing',
      'low',
      'No filings metadata found',
      'No filings were returned from the filings provider. Verify the ticker mapping, and confirm whether the entity is publicly listed (SEC/CVM).'
    );
  }

  // Basic data coverage flags
  const missing: string[] = [];
  if (!dataset.priceSnapshot) missing.push('price_snapshot');
  if (!dataset.prices || dataset.prices.length === 0) missing.push('prices_history');
  if (!dataset.incomeStatements || dataset.incomeStatements.length === 0) missing.push('income_statements');
  if (!dataset.balanceSheets || dataset.balanceSheets.length === 0) missing.push('balance_sheets');
  if (!dataset.cashFlowStatements || dataset.cashFlowStatements.length === 0) missing.push('cash_flow_statements');
  if (missing.length > 0) {
    metrics.missing_inputs = missing;
    addFlag(
      flags,
      'data_coverage_gaps',
      missing.length >= 3 ? 'medium' : 'low',
      'Data coverage gaps',
      'Some required inputs were missing, which limits the reliability of anomaly screening.',
      { missing }
    );
  }

  return { flags, metrics };
}

