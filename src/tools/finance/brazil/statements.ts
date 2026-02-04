import { z } from 'zod';
import { normalizeTicker, toBrapiSymbol, toYahooSymbol } from '../market.js';
import { getBrapiQuote } from '../providers/brapi.js';
import { getLatestPtax, addUsdFields, type PtaxRate } from '../providers/ptax.js';
import { yfinanceStatements, yfinanceInfo } from '../providers/yfinance.js';

export type BrazilStatementType = 'income' | 'balance' | 'cashflow';

export interface BrazilStatementsInput {
  ticker: string;
  period: 'annual' | 'quarterly' | 'ttm';
  limit: number;
  report_period_gt?: string;
  report_period_gte?: string;
  report_period_lt?: string;
  report_period_lte?: string;
}

export type StatementRecord = Record<string, unknown>;

function toSnakeCase(value: string): string {
  return value
    .replace(/[^\w]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function flattenYahooValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'raw' in (value as Record<string, unknown>)) {
    return (value as { raw?: unknown }).raw;
  }
  return value;
}

function normalizeRecord(record: StatementRecord): StatementRecord {
  const normalized: StatementRecord = {};
  for (const [key, value] of Object.entries(record)) {
    const flat = flattenYahooValue(value);
    const snake = toSnakeCase(key);
    normalized[snake] = flat;
  }
  return normalized;
}

function applyAliasMapping(record: StatementRecord, mapping: Record<string, string[]>): StatementRecord {
  const next: StatementRecord = { ...record };
  const keys = Object.keys(next);
  for (const [canonical, aliases] of Object.entries(mapping)) {
    if (next[canonical] !== undefined && next[canonical] !== null) continue;
    const aliasKey = aliases.map((alias) => toSnakeCase(alias)).find((alias) => keys.includes(alias));
    if (aliasKey) {
      next[canonical] = next[aliasKey];
    }
  }
  return next;
}

function extractStatementsFromBrapi(result: StatementRecord | undefined, moduleName: string): StatementRecord[] {
  if (!result) return [];
  const module = result[moduleName];
  if (!module || typeof module !== 'object') return [];
  const values = Object.values(module as Record<string, unknown>);
  const arr = values.find((value) => Array.isArray(value));
  if (!Array.isArray(arr)) return [];
  return (arr as StatementRecord[]).map((item) => normalizeRecord(item));
}

function ensureReportPeriod(record: StatementRecord): StatementRecord {
  if (record.report_period) return record;
  const endDate = record.end_date || record.enddate || record.date || record.reportdate;
  if (typeof endDate === 'string') {
    return { ...record, report_period: endDate };
  }
  if (typeof endDate === 'number') {
    return { ...record, report_period: new Date(endDate * 1000).toISOString().slice(0, 10) };
  }
  return record;
}

function filterByPeriod(records: StatementRecord[], input: BrazilStatementsInput): StatementRecord[] {
  const toDate = (value?: string) => (value ? new Date(value).getTime() : null);
  const gt = toDate(input.report_period_gt);
  const gte = toDate(input.report_period_gte);
  const lt = toDate(input.report_period_lt);
  const lte = toDate(input.report_period_lte);

  return records.filter((record) => {
    const dateStr = record.report_period as string | undefined;
    if (!dateStr) return true;
    const time = new Date(dateStr).getTime();
    if (gt !== null && !(time > gt)) return false;
    if (gte !== null && !(time >= gte)) return false;
    if (lt !== null && !(time < lt)) return false;
    if (lte !== null && !(time <= lte)) return false;
    return true;
  });
}

function computeTtmFromQuarterlies(records: StatementRecord[]): StatementRecord[] {
  const sorted = [...records].sort((a, b) => {
    const da = new Date((a.report_period as string) || 0).getTime();
    const db = new Date((b.report_period as string) || 0).getTime();
    return db - da;
  });
  const last4 = sorted.slice(0, 4);
  if (last4.length < 4) return [];
  const sums: Record<string, number> = {};
  for (const record of last4) {
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        sums[key] = (sums[key] ?? 0) + value;
      }
    }
  }
  return [
    {
      report_period: last4[0].report_period,
      period: 'ttm',
      ...sums,
    },
  ];
}

function withUsd(records: StatementRecord[], fields: string[], usdBrl: number): StatementRecord[] {
  return records.map((record) => addUsdFields(record, fields, usdBrl));
}

function computeTaxRate(record: StatementRecord): number {
  const taxExpense = record.income_tax_expense;
  const pretax = record.pretax_income ?? record.income_before_tax;
  if (typeof taxExpense === 'number' && typeof pretax === 'number' && pretax !== 0) {
    const rate = taxExpense / pretax;
    if (Number.isFinite(rate) && rate >= 0 && rate <= 0.5) return rate;
  }
  return 0.25;
}

export function computeRoic(
  incomeRecord: StatementRecord | undefined,
  balanceRecord: StatementRecord | undefined
): number | null {
  if (!incomeRecord || !balanceRecord) return null;
  const operatingIncome = incomeRecord.operating_income;
  if (typeof operatingIncome !== 'number') return null;
  const taxRate = computeTaxRate(incomeRecord);
  const nopat = operatingIncome * (1 - taxRate);

  const totalDebt = balanceRecord.total_debt;
  const totalEquity = balanceRecord.total_equity;
  const cash = balanceRecord.cash_and_equivalents;
  if (typeof totalDebt !== 'number' || typeof totalEquity !== 'number') return null;

  const investedCapital =
    totalDebt + totalEquity - (typeof cash === 'number' ? cash : 0);
  if (!Number.isFinite(investedCapital) || investedCapital === 0) return null;

  return nopat / investedCapital;
}

export async function getBrazilStatements(
  input: BrazilStatementsInput,
  statementType: BrazilStatementType
): Promise<{ data: StatementRecord[]; fx: PtaxRate; sourceUrls: string[] }> {
  const normalized = normalizeTicker(input.ticker);
  const symbol = toBrapiSymbol(normalized.canonical);
  const yahooSymbol = toYahooSymbol(normalized.canonical);
  const ptax = await getLatestPtax();
  const sourceUrls: string[] = [ptax.sourceUrl];

  let annual: StatementRecord[] = [];
  let quarterly: StatementRecord[] = [];

  try {
    const moduleMap: Record<BrazilStatementType, { annual: string; quarterly: string }> = {
      income: { annual: 'incomeStatementHistory', quarterly: 'incomeStatementHistoryQuarterly' },
      balance: { annual: 'balanceSheetHistory', quarterly: 'balanceSheetHistoryQuarterly' },
      cashflow: { annual: 'cashflowStatementHistory', quarterly: 'cashflowStatementHistoryQuarterly' },
    };
    const modules = [moduleMap[statementType].annual, moduleMap[statementType].quarterly];
    const { data, url } = await getBrapiQuote([symbol], { modules });
    sourceUrls.push(url);
    const result = Array.isArray((data as { results?: unknown[] }).results)
      ? ((data as { results?: unknown[] }).results?.[0] as StatementRecord)
      : undefined;

    annual = extractStatementsFromBrapi(result, moduleMap[statementType].annual);
    quarterly = extractStatementsFromBrapi(result, moduleMap[statementType].quarterly);
  } catch {
    // fall back to yfinance
  }

  if (annual.length === 0 || quarterly.length === 0) {
    const yf = (await yfinanceStatements({
      symbol: yahooSymbol,
      statement_type: statementType,
    })) as { annual?: StatementRecord[]; quarterly?: StatementRecord[] };
    annual = annual.length > 0 ? annual : (yf?.annual || []).map((r) => normalizeRecord(r));
    quarterly = quarterly.length > 0 ? quarterly : (yf?.quarterly || []).map((r) => normalizeRecord(r));
  }

  annual = annual.map(ensureReportPeriod);
  quarterly = quarterly.map(ensureReportPeriod);

  const mappings: Record<BrazilStatementType, Record<string, string[]>> = {
    income: {
      revenue: ['total_revenue', 'revenue'],
      net_income: ['net_income', 'net income'],
      operating_income: ['operating_income', 'operating income', 'ebit'],
      gross_profit: ['gross_profit', 'gross profit'],
      pretax_income: ['income_before_tax', 'pretax_income', 'income before tax'],
      income_tax_expense: ['income_tax_expense', 'income tax expense', 'taxes'],
    },
    balance: {
      total_debt: ['total_debt', 'short_long_term_debt_total', 'long_term_debt'],
      cash_and_equivalents: ['cash_and_cash_equivalents', 'cash', 'cash_and_short_term_investments'],
      outstanding_shares: ['shares_outstanding', 'ordinary_shares_number'],
      total_assets: ['total_assets'],
      total_liabilities: ['total_liabilities'],
      total_equity: [
        'total_shareholder_equity',
        'total_stockholder_equity',
        'total_equity_gross_minority_interest',
        'total_equity',
      ],
    },
    cashflow: {
      free_cash_flow: ['free_cash_flow', 'free cash flow'],
      net_cash_flow_from_operations: ['total_cash_from_operating_activities', 'operating_cash_flow'],
      capital_expenditure: ['capital_expenditures', 'capital_expenditure'],
    },
  };

  const mapRecord = (record: StatementRecord) => applyAliasMapping(record, mappings[statementType]);

  annual = annual.map(mapRecord);
  quarterly = quarterly.map(mapRecord);

  if (statementType === 'balance') {
    try {
      const info = (await yfinanceInfo(yahooSymbol)) as Record<string, unknown>;
      const shares = info.sharesOutstanding as number | undefined;
      if (shares) {
        const attachShares = (record: StatementRecord) =>
          record.outstanding_shares === undefined ? { ...record, outstanding_shares: shares } : record;
        annual = annual.map(attachShares);
        quarterly = quarterly.map(attachShares);
      }
    } catch {
      // ignore
    }
  }

  if (statementType === 'cashflow') {
    const ensureFcf = (record: StatementRecord) => {
      if (
        record.free_cash_flow === undefined &&
        typeof record.net_cash_flow_from_operations === 'number' &&
        typeof record.capital_expenditure === 'number'
      ) {
        const capex = record.capital_expenditure;
        const fcf =
          capex < 0
            ? record.net_cash_flow_from_operations + capex
            : record.net_cash_flow_from_operations - capex;
        return { ...record, free_cash_flow: fcf };
      }
      return record;
    };
    annual = annual.map(ensureFcf);
    quarterly = quarterly.map(ensureFcf);
  }

  let records: StatementRecord[] = [];
  if (input.period === 'annual') records = annual;
  if (input.period === 'quarterly') records = quarterly;
  if (input.period === 'ttm') {
    if (statementType === 'balance') {
      records = quarterly.length > 0 ? [quarterly[0]] : [];
      records = records.map((record) => ({ ...record, period: 'ttm' }));
    } else {
      records = computeTtmFromQuarterlies(quarterly);
    }
  }

  records = filterByPeriod(records, input).slice(0, input.limit);

  const usdFields = Object.keys(mappings[statementType]);
  const withUsdFields = withUsd(records, usdFields, ptax.usd_brl);

  return { data: withUsdFields, fx: ptax, sourceUrls };
}

