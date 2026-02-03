import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toBrapiSymbol, toYahooSymbol } from './market.js';
import { getBrapiQuote } from './providers/brapi.js';
import { getLatestPtax, addUsdFields } from './providers/ptax.js';
import { yfinanceStatements, yfinanceInfo } from './providers/yfinance.js';

type StatementRecord = Record<string, unknown>;

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
    const aliasKey = aliases
      .map((alias) => toSnakeCase(alias))
      .find((alias) => keys.includes(alias));
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

function filterByPeriod(records: StatementRecord[], input: z.infer<typeof FinancialStatementsInputSchema>): StatementRecord[] {
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

async function getBrazilStatements(
  input: z.infer<typeof FinancialStatementsInputSchema>,
  statementType: 'income' | 'balance' | 'cashflow'
): Promise<{ data: StatementRecord[]; fx: ReturnType<typeof getLatestPtax> extends Promise<infer T> ? T : never; sourceUrls: string[] }> {
  const normalized = normalizeTicker(input.ticker);
  const symbol = toBrapiSymbol(normalized.canonical);
  const yahooSymbol = toYahooSymbol(normalized.canonical);
  const ptax = await getLatestPtax();
  const sourceUrls: string[] = [ptax.sourceUrl];

  let annual: StatementRecord[] = [];
  let quarterly: StatementRecord[] = [];

  try {
    const moduleMap: Record<string, { annual: string; quarterly: string }> = {
      income: { annual: 'incomeStatementHistory', quarterly: 'incomeStatementHistoryQuarterly' },
      balance: { annual: 'balanceSheetHistory', quarterly: 'balanceSheetHistoryQuarterly' },
      cashflow: { annual: 'cashflowStatementHistory', quarterly: 'cashflowStatementHistoryQuarterly' },
    };
    const modules = [
      moduleMap[statementType].annual,
      moduleMap[statementType].quarterly,
    ];
    const { data, url } = await getBrapiQuote([symbol], { modules });
    sourceUrls.push(url);
    const result = Array.isArray((data as { results?: unknown[] }).results)
      ? (data as { results?: unknown[] }).results?.[0] as StatementRecord
      : undefined;

    annual = extractStatementsFromBrapi(result, moduleMap[statementType].annual);
    quarterly = extractStatementsFromBrapi(result, moduleMap[statementType].quarterly);
  } catch {
    // fall back to yfinance
  }

  if (annual.length === 0 || quarterly.length === 0) {
    const yf = await yfinanceStatements({ symbol: yahooSymbol, statement_type: statementType }) as { annual?: StatementRecord[]; quarterly?: StatementRecord[] };
    annual = annual.length > 0 ? annual : (yf?.annual || []).map((r) => normalizeRecord(r));
    quarterly = quarterly.length > 0 ? quarterly : (yf?.quarterly || []).map((r) => normalizeRecord(r));
  }

  annual = annual.map(ensureReportPeriod);
  quarterly = quarterly.map(ensureReportPeriod);

  const mappings: Record<'income' | 'balance' | 'cashflow', Record<string, string[]>> = {
    income: {
      revenue: ['total_revenue', 'revenue'],
      net_income: ['net_income', 'net income'],
      operating_income: ['operating_income', 'operating income', 'ebit'],
      gross_profit: ['gross_profit', 'gross profit'],
    },
    balance: {
      total_debt: ['total_debt', 'short_long_term_debt_total', 'long_term_debt'],
      cash_and_equivalents: ['cash_and_cash_equivalents', 'cash', 'cash_and_short_term_investments'],
      outstanding_shares: ['shares_outstanding', 'ordinary_shares_number'],
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
      const info = await yfinanceInfo(yahooSymbol) as Record<string, unknown>;
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
      if (record.free_cash_flow === undefined && typeof record.net_cash_flow_from_operations === 'number' && typeof record.capital_expenditure === 'number') {
        const capex = record.capital_expenditure;
        const fcf = capex < 0
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

const FinancialStatementsInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch financial statements for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .describe(
      "The reporting period for the financial statements. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(10)
    .describe(
      'Maximum number of report periods to return (default: 10). Returns the most recent N periods based on the period type.'
    ),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for financial statements with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for financial statements with report periods on or before this date (YYYY-MM-DD).'
    ),
});

function createParams(input: z.infer<typeof FinancialStatementsInputSchema>): Record<string, string | number | undefined> {
  return {
    ticker: input.ticker,
    period: input.period,
    limit: input.limit,
    report_period_gt: input.report_period_gt,
    report_period_gte: input.report_period_gte,
    report_period_lt: input.report_period_lt,
    report_period_lte: input.report_period_lte,
  };
}

export const getIncomeStatements = new DynamicStructuredTool({
  name: 'get_income_statements',
  description: `Fetches a company's income statements, detailing its revenues, expenses, net income, etc. over a reporting period. Useful for evaluating a company's profitability and operational efficiency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const { data, fx, sourceUrls } = await getBrazilStatements(input, 'income');
      return formatToolResult({ income_statements: data, fx, currency: 'BRL' }, sourceUrls);
    }
    const params = createParams(input);
    const { data, url } = await callApi('/financials/income-statements/', params);
    return formatToolResult(data.income_statements || {}, [url]);
  },
});

export const getBalanceSheets = new DynamicStructuredTool({
  name: 'get_balance_sheets',
  description: `Retrieves a company's balance sheets, providing a snapshot of its assets, liabilities, shareholders' equity, etc. at a specific point in time. Useful for assessing a company's financial position.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const { data, fx, sourceUrls } = await getBrazilStatements(input, 'balance');
      return formatToolResult({ balance_sheets: data, fx, currency: 'BRL' }, sourceUrls);
    }
    const params = createParams(input);
    const { data, url } = await callApi('/financials/balance-sheets/', params);
    return formatToolResult(data.balance_sheets || {}, [url]);
  },
});

export const getCashFlowStatements = new DynamicStructuredTool({
  name: 'get_cash_flow_statements',
  description: `Retrieves a company's cash flow statements, showing how cash is generated and used across operating, investing, and financing activities. Useful for understanding a company's liquidity and solvency.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const { data, fx, sourceUrls } = await getBrazilStatements(input, 'cashflow');
      return formatToolResult({ cash_flow_statements: data, fx, currency: 'BRL' }, sourceUrls);
    }
    const params = createParams(input);
    const { data, url } = await callApi('/financials/cash-flow-statements/', params);
    return formatToolResult(data.cash_flow_statements || {}, [url]);
  },
});

export const getAllFinancialStatements = new DynamicStructuredTool({
  name: 'get_all_financial_statements',
  description: `Retrieves all three financial statements (income statements, balance sheets, and cash flow statements) for a company in a single API call. This is more efficient than calling each statement type separately when you need all three for comprehensive financial analysis.`,
  schema: FinancialStatementsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const income = await getBrazilStatements(input, 'income');
      const balance = await getBrazilStatements(input, 'balance');
      const cashflow = await getBrazilStatements(input, 'cashflow');
      const sourceUrls = [...new Set([...income.sourceUrls, ...balance.sourceUrls, ...cashflow.sourceUrls])];
      return formatToolResult(
        {
          financials: {
            income_statements: income.data,
            balance_sheets: balance.data,
            cash_flow_statements: cashflow.data,
          },
          fx: income.fx,
          currency: 'BRL',
        },
        sourceUrls
      );
    }
    const params = createParams(input);
    const { data, url } = await callApi('/financials/', params);
    return formatToolResult(data.financials || {}, [url]);
  },
});
