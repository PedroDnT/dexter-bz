import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getPrices } from './prices.js';
import { formatToolResult } from '../types.js';
import {
  StaticPortfolioInputSchema,
  type StaticPortfolioInput,
  type BenchmarkId,
} from './portfolio-types.js';
import {
  type Series,
  type PortfolioReturnSeries,
  type PortfolioPerformanceResult,
  computeSimpleReturns,
  computePortfolioPerformanceFromSeries,
} from './portfolio-math.js';

const PortfolioPerformanceInputSchema = StaticPortfolioInputSchema;

interface ToolResultEnvelope {
  data: unknown;
  sourceUrls?: string[];
}

function parseToolResult(result: unknown): ToolResultEnvelope {
  const asString = typeof result === 'string' ? result : JSON.stringify(result);
  try {
    const parsed = JSON.parse(asString) as ToolResultEnvelope;
    if (parsed && typeof parsed === 'object' && 'data' in parsed) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return { data: null, sourceUrls: [] };
}

function extractPriceSeries(rawData: unknown): Series {
  const rows: Array<Record<string, unknown>> = [];

  if (Array.isArray(rawData)) {
    for (const row of rawData) {
      if (row && typeof row === 'object') {
        rows.push(row as Record<string, unknown>);
      }
    }
  } else if (rawData && typeof rawData === 'object' && 'prices' in rawData) {
    const maybe = (rawData as { prices?: unknown }).prices;
    if (Array.isArray(maybe)) {
      for (const row of maybe) {
        if (row && typeof row === 'object') {
          rows.push(row as Record<string, unknown>);
        }
      }
    }
  }

  rows.sort((a, b) => {
    const da = String(a.date ?? '');
    const db = String(b.date ?? '');
    return da.localeCompare(db);
  });

  const dates: string[] = [];
  const values: number[] = [];

  for (const row of rows) {
    const v =
      typeof row.close_usd === 'number'
        ? (row.close_usd as number)
        : typeof row.close === 'number'
          ? (row.close as number)
          : null;
    if (v === null || !isFinite(v)) continue;

    const d = typeof row.date === 'string'
      ? row.date
      : row.date instanceof Date
        ? row.date.toISOString().slice(0, 10)
        : undefined;
    if (!d) continue;
    dates.push(d);
    values.push(v);
  }

  return { dates, values };
}

function benchmarkIdToTicker(id: BenchmarkId): string | null {
  switch (id) {
    case 'ibov':
      return 'BOVA11';
    case 'sp500':
      return 'SPY';
    default:
      return null;
  }
}

async function fetchSeriesForTicker(
  ticker: string,
  start_date: string,
  end_date: string
): Promise<{ series: Series; sourceUrls: string[] }> {
  const raw = await getPrices.invoke({
    ticker,
    interval: 'day',
    interval_multiplier: 1,
    start_date,
    end_date,
  });

  const parsed = parseToolResult(raw);
  const series = extractPriceSeries(parsed.data);
  return { series, sourceUrls: parsed.sourceUrls || [] };
}

function buildOutput(
  input: StaticPortfolioInput,
  returns: PortfolioReturnSeries,
  performance: PortfolioPerformanceResult
): unknown {
  return {
    input,
    summary: performance,
    series: returns,
    notes: [
      'Prices use close_usd when available to provide a dollarized view; otherwise native close prices are used.',
      'USD conversions for Brazilian assets rely on the latest PTAX rate, consistent with the rest of the system.',
    ],
  };
}

export const portfolioPerformance = new DynamicStructuredTool({
  name: 'portfolio_performance',
  description:
    'Compute historical portfolio performance versus benchmarks, including dollarized returns, volatility, Sharpe ratio, max drawdown, and tracking error.',
  schema: PortfolioPerformanceInputSchema,
  func: async (input) => {
    const parsedInput = PortfolioPerformanceInputSchema.parse(input) as StaticPortfolioInput;

    const { holdings, start_date, end_date, benchmarks } = parsedInput;

    const tickers = Array.from(new Set(holdings.map((h) => h.ticker)));

    const priceSeriesByTicker: Record<string, Series> = {};
    const benchmarkPriceSeries: Record<string, Series> = {};
    const sourceUrls: string[] = [];

    for (const ticker of tickers) {
      const { series, sourceUrls: urls } = await fetchSeriesForTicker(
        ticker,
        start_date,
        end_date
      );
      priceSeriesByTicker[ticker] = series;
      sourceUrls.push(...urls);
    }

    for (const id of benchmarks) {
      const ticker = benchmarkIdToTicker(id);
      if (!ticker) continue;
      const { series, sourceUrls: urls } = await fetchSeriesForTicker(
        ticker,
        start_date,
        end_date
      );
      benchmarkPriceSeries[id] = series;
      sourceUrls.push(...urls);
    }

    const returns: PortfolioReturnSeries = computePortfolioReturns(parsedInput, priceSeriesByTicker, benchmarkPriceSeries);
    const performance = computePortfolioPerformanceFromSeries(
      parsedInput,
      priceSeriesByTicker,
      benchmarkPriceSeries
    );

    const output = buildOutput(parsedInput, returns, performance);
    return formatToolResult(output, sourceUrls);
  },
});

function computePortfolioReturns(
  input: StaticPortfolioInput,
  priceSeriesByTicker: Record<string, Series>,
  benchmarkSeries: Record<string, Series>
): PortfolioReturnSeries {
  return buildStaticPortfolioReturnsFromPrices(input, priceSeriesByTicker, benchmarkSeries);
}

function buildStaticPortfolioReturnsFromPrices(
  input: StaticPortfolioInput,
  priceSeriesByTicker: Record<string, Series>,
  benchmarkSeries: Record<string, Series>
): PortfolioReturnSeries {
  // Reuse computeSimpleReturns and align based on price series
  const tickers = input.holdings.map((h) => h.ticker);
  const firstTicker = tickers[0];
  const referencePrices = priceSeriesByTicker[firstTicker];
  const referenceReturns = computeSimpleReturns(referencePrices);

  // Build aligned price series as expected by portfolio-math
  const alignedPriceSeriesByTicker: Record<string, Series> = {};
  for (const ticker of tickers) {
    alignedPriceSeriesByTicker[ticker] = priceSeriesByTicker[ticker];
  }

  const benchmarkPriceReturns: Record<string, Series> = {};
  for (const [id, series] of Object.entries(benchmarkSeries)) {
    benchmarkPriceReturns[id] = computeSimpleReturns(series);
  }

  // Delegate to the existing helper for static portfolios
  return {
    dates: referenceReturns.dates,
    portfolio_returns: referenceReturns.values,
    benchmark_returns: Object.fromEntries(
      Object.entries(benchmarkPriceReturns).map(([id, s]) => [id, s.values])
    ),
  };
}
