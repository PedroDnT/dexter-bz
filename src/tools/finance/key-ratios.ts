import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toYahooSymbol } from './market.js';
import { yfinanceInfo } from './providers/yfinance.js';
import { getLatestPtax, addUsdFields } from './providers/ptax.js';
import { recordBrazilGap } from './brazil-features.js';

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
      recordBrazilGap('Historical key ratios (Brazil)', 'Only snapshot-level ratios are returned today.');
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const info = await yfinanceInfo(symbol) as Record<string, unknown>;
      const ptax = await getLatestPtax();
      const price = (info.currentPrice ?? info.regularMarketPrice) as number | undefined;
      const shares = info.sharesOutstanding as number | undefined;
      const marketCap = (info.marketCap as number | undefined) ?? (price && shares ? price * shares : undefined);

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
      };

      const withUsd = addUsdFields(snapshot as Record<string, unknown>, ['market_cap', 'enterprise_value'], ptax.usd_brl);
      return formatToolResult({ ...withUsd, fx: ptax }, [ptax.sourceUrl]);
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
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const info = await yfinanceInfo(symbol) as Record<string, unknown>;
      const ptax = await getLatestPtax();
      const price = (info.currentPrice ?? info.regularMarketPrice) as number | undefined;
      const shares = info.sharesOutstanding as number | undefined;
      const marketCap = (info.marketCap as number | undefined) ?? (price && shares ? price * shares : undefined);

      const record = {
        report_period: new Date().toISOString().slice(0, 10),
        market_cap: marketCap ?? null,
        enterprise_value: info.enterpriseValue ?? null,
        pe_ratio: info.trailingPE ?? null,
        forward_pe: info.forwardPE ?? null,
        dividend_yield: info.dividendYield ?? null,
        price_to_book: info.priceToBook ?? null,
        profit_margins: info.profitMargins ?? null,
        return_on_equity: info.returnOnEquity ?? null,
        currency: info.currency ?? 'BRL',
      };

      const withUsd = addUsdFields(record as Record<string, unknown>, ['market_cap', 'enterprise_value'], ptax.usd_brl);
      return formatToolResult([withUsd], [ptax.sourceUrl]);
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
