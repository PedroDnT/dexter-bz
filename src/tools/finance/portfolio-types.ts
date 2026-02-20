import { z } from 'zod';

// Basic holding specification for a static-weight portfolio
export const PortfolioHoldingSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .describe('Ticker symbol for the asset (e.g., AAPL, BOVA11).'),
  weight: z
    .number()
    .describe('Target portfolio weight for this asset (e.g., 0.25 for 25%).'),
});

export type PortfolioHolding = z.infer<typeof PortfolioHoldingSchema>;

// Named benchmark identifiers exposed to the LLM;
// these are resolved to concrete tickers or synthetic series internally.
export const BenchmarkIdSchema = z
  .enum(['ibov', 'sp500'])
  .describe(
    "Named benchmark identifier. 'ibov' for Ibovespa (BOVA11 proxy), 'sp500' for S&P 500."
  );

export type BenchmarkId = z.infer<typeof BenchmarkIdSchema>;

export const RiskFreeSpecSchema = z
  .object({
    type: z
      .enum(['none', 'constant'])
      .default('constant')
      .describe("How to specify the risk-free rate for Sharpe ratio calculations."),
    value_annual: z
      .number()
      .optional()
      .describe(
        'Annualized risk-free rate as a decimal (e.g., 0.04 for 4%). Required when type is constant.'
      ),
  })
  .default({ type: 'constant', value_annual: 0.04 });

export type RiskFreeSpec = z.infer<typeof RiskFreeSpecSchema>;

export const ReturnFrequencySchema = z
  .enum(['daily', 'weekly', 'monthly'])
  .default('daily')
  .describe('Frequency at which to compute portfolio returns and risk metrics.');

export type ReturnFrequency = z.infer<typeof ReturnFrequencySchema>;

export const StaticPortfolioInputSchema = z.object({
  holdings: z
    .array(PortfolioHoldingSchema)
    .min(1)
    .describe('List of portfolio holdings with target weights.'),
  start_date: z
    .string()
    .describe('Start date for the analysis in YYYY-MM-DD format.'),
  end_date: z
    .string()
    .describe('End date for the analysis in YYYY-MM-DD format.'),
  benchmarks: z
    .array(BenchmarkIdSchema)
    .default([])
    .describe('Optional list of named benchmarks to compare against.'),
  return_frequency: ReturnFrequencySchema,
  risk_free: RiskFreeSpecSchema,
});

export type StaticPortfolioInput = z.infer<typeof StaticPortfolioInputSchema>;
