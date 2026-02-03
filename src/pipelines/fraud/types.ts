import type { Market } from '../../tools/finance/market.js';
import type { PtaxRate } from '../../tools/finance/providers/ptax.js';

export type InvestigationMarket = Exclude<Market, 'CRYPTO'>;

export interface InvestigationTargetInput {
  query: string;
  label?: string;
}

export interface ResolvedTarget {
  query: string;
  label: string;
  ticker: string;
  market: InvestigationMarket;
  yahooSymbol?: string;
  brapiSymbol?: string;
  resolvedFrom: 'ticker' | 'yfinance_search';
}

export interface FetchError {
  step: string;
  error: string;
}

export interface FraudDataset {
  companyFacts?: Record<string, unknown>;
  priceSnapshot?: Record<string, unknown>;
  prices?: Array<Record<string, unknown>>;
  incomeStatements?: Array<Record<string, unknown>>;
  balanceSheets?: Array<Record<string, unknown>>;
  cashFlowStatements?: Array<Record<string, unknown>>;
  keyRatiosSnapshot?: Record<string, unknown>;
  filings?: Array<Record<string, unknown>>;
  currency?: string;
  fx?: PtaxRate;
}

export type FlagSeverity = 'low' | 'medium' | 'high';

export interface FraudFlag {
  id: string;
  severity: FlagSeverity;
  title: string;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface FraudMetrics {
  [key: string]: unknown;
}

export interface FraudInvestigationResult {
  target: ResolvedTarget;
  asOf: string;
  dataset: FraudDataset;
  flags: FraudFlag[];
  metrics: FraudMetrics;
  sources: string[];
  errors: FetchError[];
  disclaimer: string;
}

