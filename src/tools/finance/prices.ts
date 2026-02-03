import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toBrapiSymbol, toYahooSymbol } from './market.js';
import { getBrapiQuote } from './providers/brapi.js';
import { getLatestPtax, addUsdFields } from './providers/ptax.js';
import { yfinanceHistory } from './providers/yfinance.js';

const PriceSnapshotInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch the price snapshot for. For example, 'AAPL' for Apple."
    ),
});

export const getPriceSnapshot = new DynamicStructuredTool({
  name: 'get_price_snapshot',
  description: `Fetches the most recent price snapshot for a specific stock ticker, including the latest price, trading volume, and other open, high, low, and close price data.`,
  schema: PriceSnapshotInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toBrapiSymbol(normalized.canonical);
      const { data, url } = await getBrapiQuote([symbol], { modules: ['price', 'summaryDetail'] });
      const result = Array.isArray((data as { results?: unknown[] }).results)
        ? (data as { results?: unknown[] }).results?.[0] as Record<string, unknown>
        : undefined;
      const ptax = await getLatestPtax();

      const snapshot = {
        symbol,
        price: typeof result?.regularMarketPrice === 'number' ? result.regularMarketPrice : null,
        open: typeof result?.regularMarketOpen === 'number' ? result.regularMarketOpen : null,
        high: typeof result?.regularMarketDayHigh === 'number' ? result.regularMarketDayHigh : null,
        low: typeof result?.regularMarketDayLow === 'number' ? result.regularMarketDayLow : null,
        previous_close: typeof result?.regularMarketPreviousClose === 'number' ? result.regularMarketPreviousClose : null,
        volume: typeof result?.regularMarketVolume === 'number' ? result.regularMarketVolume : null,
        market_cap: typeof result?.marketCap === 'number' ? result.marketCap : null,
        currency: (result?.currency as string) || 'BRL',
        as_of: typeof result?.regularMarketTime === 'number'
          ? new Date((result.regularMarketTime as number) * 1000).toISOString()
          : null,
      };

      const withUsd = addUsdFields(snapshot as Record<string, unknown>, ['price', 'open', 'high', 'low', 'previous_close', 'market_cap'], ptax.usd_brl);
      return formatToolResult(
        { ...withUsd, fx: ptax },
        [url, ptax.sourceUrl]
      );
    }

    const params = { ticker: input.ticker };
    const { data, url } = await callApi('/prices/snapshot/', params);
    return formatToolResult(data.snapshot || {}, [url]);
  },
});

const PricesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch aggregated prices for. For example, 'AAPL' for Apple."
    ),
  interval: z
    .enum(['minute', 'day', 'week', 'month', 'year'])
    .default('day')
    .describe("The time interval for price data. Defaults to 'day'."),
  interval_multiplier: z
    .number()
    .default(1)
    .describe('Multiplier for the interval. Defaults to 1.'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format. Must be in past. Required.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format. Must be today or in the past. Required.'),
});

export const getPrices = new DynamicStructuredTool({
  name: 'get_prices',
  description: `Retrieves historical price data for a stock over a specified date range, including open, high, low, close prices, and volume.`,
  schema: PricesInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const ptax = await getLatestPtax();
      const data = await yfinanceHistory({
        symbol,
        start_date: input.start_date,
        end_date: input.end_date,
        interval: input.interval,
      }) as Array<Record<string, unknown>>;
      const prices = data.map((row) => addUsdFields(row as Record<string, unknown>, ['open', 'high', 'low', 'close'], ptax.usd_brl));
      return formatToolResult(
        { prices, fx: ptax, currency: 'BRL' },
        [ptax.sourceUrl, 'https://finance.yahoo.com']
      );
    }

    const params = {
      ticker: input.ticker,
      interval: input.interval,
      interval_multiplier: input.interval_multiplier,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const { data, url } = await callApi('/prices/', params);
    return formatToolResult(data.prices || [], [url]);
  },
});
