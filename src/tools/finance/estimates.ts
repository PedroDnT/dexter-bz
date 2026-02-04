import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toYahooSymbol } from './market.js';
import { yfinanceEstimates } from './providers/yfinance.js';

export function normalizeYfinanceEstimates(payload: unknown): Record<string, unknown> {
  const info = (payload && typeof payload === 'object' && 'info' in (payload as Record<string, unknown>))
    ? ((payload as { info?: Record<string, unknown> }).info ?? {})
    : {};

  const priceTargets = {
    mean: info.targetMeanPrice ?? null,
    high: info.targetHighPrice ?? null,
    low: info.targetLowPrice ?? null,
  };
  const recommendation = {
    mean: info.recommendationMean ?? null,
    key: info.recommendationKey ?? null,
  };
  const eps = {
    forward: info.forwardEps ?? null,
    trailing: info.trailingEps ?? null,
  };
  const analystCount = info.numberOfAnalystOpinions ?? null;

  const missing: string[] = [];
  if (priceTargets.mean === null && priceTargets.high === null && priceTargets.low === null) {
    missing.push('price_targets');
  }
  if (recommendation.mean === null && recommendation.key === null) {
    missing.push('recommendation');
  }
  if (eps.forward === null && eps.trailing === null) {
    missing.push('eps');
  }
  if (analystCount === null) {
    missing.push('analyst_count');
  }

  return {
    price_targets: priceTargets,
    recommendation,
    eps,
    analyst_count: analystCount,
    source: 'yfinance/yahoo',
    note: missing.length > 0 ? `Missing fields from yfinance: ${missing.join(', ')}` : undefined,
  };
}

const AnalystEstimatesInputSchema = z.object({
  ticker: z
    .string()
    .describe(
      "The stock ticker symbol to fetch analyst estimates for. For example, 'AAPL' for Apple."
    ),
  period: z
    .enum(['annual', 'quarterly'])
    .default('annual')
    .describe("The period for the estimates, either 'annual' or 'quarterly'."),
});

export const getAnalystEstimates = new DynamicStructuredTool({
  name: 'get_analyst_estimates',
  description: `Retrieves analyst estimates for a given company ticker, including metrics like estimated EPS. Useful for understanding consensus expectations, assessing future growth prospects, and performing valuation analysis.`,
  schema: AnalystEstimatesInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const estimates = await yfinanceEstimates(symbol);
      const normalizedEstimates = normalizeYfinanceEstimates(estimates);
      return formatToolResult(normalizedEstimates, ['https://finance.yahoo.com']);
    }
    const params = {
      ticker: input.ticker,
      period: input.period,
    };
    const { data, url } = await callApi('/analyst-estimates/', params);
    return formatToolResult(data.analyst_estimates || [], [url]);
  },
});
