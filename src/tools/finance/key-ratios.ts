import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toYahooSymbol } from './market.js';
import { yfinanceInfo } from './providers/yfinance.js';
import { addUsdFields } from './providers/ptax.js';
import { getBrazilStatements, computeRoic, type StatementRecord, type BrazilStatementsInput } from './brazil/statements.js';

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

function safeGrowth(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  const growth = (current - previous) / Math.abs(previous);
  return Number.isFinite(growth) ? growth : null;
}

function sortByPeriodDesc(records: StatementRecord[]): StatementRecord[] {
  return [...records].sort((a, b) => {
    const da = new Date((a.report_period as string) || 0).getTime();
    const db = new Date((b.report_period as string) || 0).getTime();
    return db - da;
  });
}

function filterByPeriod(records: Array<Record<string, unknown>>, input: z.infer<typeof KeyRatiosInputSchema>): Array<Record<string, unknown>> {
  if (input.report_period) {
    return records.filter((record) => record.report_period === input.report_period);
  }

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

function indexByPeriod(records: StatementRecord[]): Map<string, StatementRecord> {
  const map = new Map<string, StatementRecord>();
  for (const record of records) {
    const period = record.report_period as string | undefined;
    if (!period) continue;
    if (!map.has(period)) {
      map.set(period, record);
    }
  }
  return map;
}

export function computeBrazilKeyRatioSeries(params: {
  income: StatementRecord[];
  balance: StatementRecord[];
  cashflow: StatementRecord[];
  currency: string;
}): Array<Record<string, unknown>> {
  const incomeSorted = sortByPeriodDesc(params.income);
  const balanceSorted = sortByPeriodDesc(params.balance);
  const cashSorted = sortByPeriodDesc(params.cashflow);

  const incomeBy = indexByPeriod(incomeSorted);
  const balanceBy = indexByPeriod(balanceSorted);
  const cashBy = indexByPeriod(cashSorted);

  const periods = Array.from(
    new Set([
      ...incomeSorted.map((r) => r.report_period as string | undefined),
      ...balanceSorted.map((r) => r.report_period as string | undefined),
      ...cashSorted.map((r) => r.report_period as string | undefined),
    ].filter(Boolean))
  ).sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime()) as string[];

  const series: Array<Record<string, unknown>> = [];
  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i];
    const prevPeriod = periods[i + 1];

    const income = incomeBy.get(period);
    const incomePrev = prevPeriod ? incomeBy.get(prevPeriod) : undefined;
    const balance = balanceBy.get(period);
    const cashflow = cashBy.get(period);
    const cashflowPrev = prevPeriod ? cashBy.get(prevPeriod) : undefined;

    const revenue = toNumber(income?.revenue ?? income?.total_revenue);
    const revenuePrev = toNumber(incomePrev?.revenue ?? incomePrev?.total_revenue);
    const fcf = toNumber(cashflow?.free_cash_flow);
    const fcfPrev = toNumber(cashflowPrev?.free_cash_flow);

    const totalDebt = toNumber(balance?.total_debt);
    const totalEquity = toNumber(balance?.total_equity);
    const shares = toNumber(balance?.outstanding_shares);

    series.push({
      report_period: period,
      currency: params.currency,
      revenue,
      free_cash_flow: fcf,
      revenue_growth: safeGrowth(revenue, revenuePrev),
      free_cash_flow_growth: safeGrowth(fcf, fcfPrev),
      debt_to_equity: safeDivide(totalDebt, totalEquity),
      free_cash_flow_per_share: safeDivide(fcf, shares),
      return_on_invested_capital: computeRoic(income, balance),
    });
  }

  return series;
}

const KeyRatiosSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getKeyRatiosSnapshot = new DynamicStructuredTool({
  name: 'get_key_ratios_snapshot',
  description: `Fetches a snapshot of the most current key ratios for a company, including key indicators like market capitalization, P/E ratio, and dividend yield. Useful for a quick overview of a company's financial health.`,
  schema: KeyRatiosSnapshotInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const info = await yfinanceInfo(symbol) as Record<string, unknown>;
      const statementInput: BrazilStatementsInput = {
        ticker: input.ticker,
        period: 'annual',
        limit: 2,
      };
      const [income, balance, cashflow] = await Promise.all([
        getBrazilStatements(statementInput, 'income'),
        getBrazilStatements(statementInput, 'balance'),
        getBrazilStatements(statementInput, 'cashflow'),
      ]);
      const ptax = income.fx;
      const price = (info.currentPrice ?? info.regularMarketPrice) as number | undefined;
      const shares = info.sharesOutstanding as number | undefined;
      const marketCap = (info.marketCap as number | undefined) ?? (price && shares ? price * shares : undefined);
      const ratioSeries = computeBrazilKeyRatioSeries({
        income: income.data,
        balance: balance.data,
        cashflow: cashflow.data,
        currency: info.currency ?? 'BRL',
      });
      const latestRatio = ratioSeries[0] ?? {};

      const snapshot = {
        market_cap: marketCap ?? null,
        enterprise_value: info.enterpriseValue ?? null,
        pe_ratio: info.trailingPE ?? null,
        forward_pe: info.forwardPE ?? null,
        dividend_yield: info.dividendYield ?? null,
        price_to_book: info.priceToBook ?? null,
        profit_margins: info.profitMargins ?? null,
        return_on_equity: info.returnOnEquity ?? null,
        currency: info.currency ?? 'BRL',
        as_of: new Date().toISOString().slice(0, 10),
        ...latestRatio,
      };

      const withUsd = addUsdFields(
        snapshot as Record<string, unknown>,
        ['market_cap', 'enterprise_value', 'revenue', 'free_cash_flow'],
        ptax.usd_brl
      );
      const sourceUrls = [
        ...new Set([
          ...income.sourceUrls,
          ...balance.sourceUrls,
          ...cashflow.sourceUrls,
          ptax.sourceUrl,
          'https://finance.yahoo.com',
        ]),
      ];
      return formatToolResult({ ...withUsd, fx: ptax }, sourceUrls);
    }

    const params = { ticker: input.ticker };
    const { data, url } = await callApi('/financial-metrics/snapshot/', params);
    return formatToolResult(data.snapshot || {}, [url]);
  },
});

const KeyRatiosInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch key ratios for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly', 'ttm'])
    .default('ttm')
    .describe(
      "The reporting period. 'annual' for yearly, 'quarterly' for quarterly, and 'ttm' for trailing twelve months."
    ),
  limit: z
    .number()
    .default(4)
    .describe('The number of past financial statements to retrieve.'),
  report_period: z
    .string()
    .optional()
    .describe('Filter for key ratios with an exact report period date (YYYY-MM-DD).'),
  report_period_gt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods after this date (YYYY-MM-DD).'),
  report_period_gte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or after this date (YYYY-MM-DD).'
    ),
  report_period_lt: z
    .string()
    .optional()
    .describe('Filter for key ratios with report periods before this date (YYYY-MM-DD).'),
  report_period_lte: z
    .string()
    .optional()
    .describe(
      'Filter for key ratios with report periods on or before this date (YYYY-MM-DD).'
    ),
});

export const getKeyRatios = new DynamicStructuredTool({
  name: 'get_key_ratios',
  description: `Retrieves historical key ratios for a company, such as P/E ratio, revenue per share, and enterprise value, over a specified period. Useful for trend analysis and historical performance evaluation.`,
  schema: KeyRatiosInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const statementInput: BrazilStatementsInput = {
        ticker: input.ticker,
        period: input.period,
        limit: input.limit + 1,
      };
      const [income, balance, cashflow] = await Promise.all([
        getBrazilStatements(statementInput, 'income'),
        getBrazilStatements(statementInput, 'balance'),
        getBrazilStatements(statementInput, 'cashflow'),
      ]);

      const currency = 'BRL';
      const series = computeBrazilKeyRatioSeries({
        income: income.data,
        balance: balance.data,
        cashflow: cashflow.data,
        currency,
      });

      const filtered = filterByPeriod(series, input).slice(0, input.limit);
      const sourceUrls = [...new Set([...income.sourceUrls, ...balance.sourceUrls, ...cashflow.sourceUrls])];

      return formatToolResult(filtered, sourceUrls);
    }

    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      period: input.period,
      limit: input.limit,
      report_period: input.report_period,
      report_period_gt: input.report_period_gt,
      report_period_gte: input.report_period_gte,
      report_period_lt: input.report_period_lt,
      report_period_lte: input.report_period_lte,
    };
    const { data, url } = await callApi('/financial-metrics/', params);
    return formatToolResult(data.financial_metrics || [], [url]);
  },
});
