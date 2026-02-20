import type { ReturnFrequency, RiskFreeSpec, StaticPortfolioInput } from './portfolio-types.js';

export interface PricePoint {
  date: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  [key: string]: unknown;
}

export interface Series {
  dates: string[];
  values: number[];
}

export interface PortfolioReturnSeries {
  dates: string[];
  portfolio_returns: number[];
  benchmark_returns: Record<string, number[]>;
}

export interface PortfolioSummaryMetrics {
  annualized_return: number | null;
  annualized_volatility: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
}

export interface BenchmarkSummaryMetrics extends PortfolioSummaryMetrics {
  id: string;
  relative_return: number | null;
  tracking_error: number | null;
}

export interface PortfolioPerformanceResult {
  portfolio: PortfolioSummaryMetrics;
  benchmarks: BenchmarkSummaryMetrics[];
}

export function normalizeWeights(weights: number[]): number[] {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (!isFinite(total) || total === 0) {
    return weights.map(() => 0);
  }
  return weights.map((w) => w / total);
}

export function computeSimpleReturns(prices: Series): Series {
  const values: number[] = [];
  const dates: string[] = [];
  for (let i = 1; i < prices.values.length; i++) {
    const prev = prices.values[i - 1];
    const curr = prices.values[i];
    if (prev === 0 || !isFinite(prev) || !isFinite(curr)) {
      continue;
    }
    const r = (curr - prev) / prev;
    values.push(r);
    dates.push(prices.dates[i]);
  }
  return { dates, values };
}

export function computeCumulativeReturns(returns: Series): Series {
  const values: number[] = [];
  let cumulative = 1;
  for (let i = 0; i < returns.values.length; i++) {
    const r = returns.values[i];
    cumulative *= 1 + r;
    values.push(cumulative - 1);
  }
  return { dates: returns.dates.slice(), values };
}

export function annualizeReturn(returns: Series, frequency: ReturnFrequency): number | null {
  if (returns.values.length === 0) return null;
  const cumulative = returns.values.reduce((acc, r) => acc * (1 + r), 1) - 1;
  const periodsPerYear = getPeriodsPerYear(frequency);
  const n = returns.values.length;
  if (n === 0) return null;
  const years = n / periodsPerYear;
  if (years <= 0) return null;
  return Math.pow(1 + cumulative, 1 / years) - 1;
}

export function annualizeVolatility(returns: Series, frequency: ReturnFrequency): number | null {
  if (returns.values.length === 0) return null;
  const mean = returns.values.reduce((sum, r) => sum + r, 0) / returns.values.length;
  const variance =
    returns.values.reduce((sum, r) => sum + (r - mean) * (r - mean), 0) /
    (returns.values.length - 1 || 1);
  const periodsPerYear = getPeriodsPerYear(frequency);
  return Math.sqrt(variance * periodsPerYear);
}

export function computeSharpe(
  returns: Series,
  frequency: ReturnFrequency,
  riskFree: RiskFreeSpec
): number | null {
  if (returns.values.length === 0) return null;
  const periodsPerYear = getPeriodsPerYear(frequency);
  const rfAnnual = riskFree.type === 'none' ? 0 : riskFree.value_annual ?? 0.04;
  const rfPerPeriod = Math.pow(1 + rfAnnual, 1 / periodsPerYear) - 1;
  const excess = returns.values.map((r) => r - rfPerPeriod);
  const meanExcess = excess.reduce((sum, r) => sum + r, 0) / excess.length;
  const variance =
    excess.reduce((sum, r) => sum + (r - meanExcess) * (r - meanExcess), 0) /
    (excess.length - 1 || 1);
  const vol = Math.sqrt(variance * periodsPerYear);
  if (vol === 0) return null;
  return (meanExcess * periodsPerYear) / vol;
}

export function computeMaxDrawdown(cumulative: Series): number | null {
  if (cumulative.values.length === 0) return null;
  let peak = cumulative.values[0];
  let maxDd = 0;
  for (let i = 1; i < cumulative.values.length; i++) {
    const value = cumulative.values[i];
    if (value > peak) {
      peak = value;
    }
    const dd = (value - peak) / (1 + peak);
    if (dd < maxDd) {
      maxDd = dd;
    }
  }
  return maxDd;
}

export function getPeriodsPerYear(frequency: ReturnFrequency): number {
  switch (frequency) {
    case 'daily':
      return 252;
    case 'weekly':
      return 52;
    case 'monthly':
      return 12;
    default:
      return 252;
  }
}

export function summarizeSeries(
  returns: Series,
  frequency: ReturnFrequency,
  riskFree: RiskFreeSpec
): PortfolioSummaryMetrics {
  const annualized_return = annualizeReturn(returns, frequency);
  const annualized_volatility = annualizeVolatility(returns, frequency);
  const sharpe_ratio = computeSharpe(returns, frequency, riskFree);
  const cumulative = computeCumulativeReturns(returns);
  const max_drawdown = computeMaxDrawdown(cumulative);
  return { annualized_return, annualized_volatility, sharpe_ratio, max_drawdown };
}

export function computeTrackingError(
  portfolio: Series,
  benchmark: Series,
  frequency: ReturnFrequency
): number | null {
  if (portfolio.values.length === 0 || benchmark.values.length === 0) return null;
  const { values: alignedPortfolio, values2: alignedBenchmark } = alignReturnSeries(
    portfolio,
    benchmark
  );
  if (alignedPortfolio.length === 0) return null;
  const diffs = alignedPortfolio.map((r, i) => r - alignedBenchmark[i]);
  const meanDiff = diffs.reduce((sum, r) => sum + r, 0) / diffs.length;
  const variance =
    diffs.reduce((sum, r) => sum + (r - meanDiff) * (r - meanDiff), 0) /
    (diffs.length - 1 || 1);
  const periodsPerYear = getPeriodsPerYear(frequency);
  return Math.sqrt(variance * periodsPerYear);
}

export function alignReturnSeries(a: Series, b: Series): {
  dates: string[];
  values: number[];
  values2: number[];
} {
  const indexB = new Map<string, number>();
  for (let i = 0; i < b.dates.length; i++) {
    indexB.set(b.dates[i], b.values[i]);
  }
  const dates: string[] = [];
  const values: number[] = [];
  const values2: number[] = [];
  for (let i = 0; i < a.dates.length; i++) {
    const d = a.dates[i];
    const v2 = indexB.get(d);
    if (v2 === undefined) continue;
    dates.push(d);
    values.push(a.values[i]);
    values2.push(v2);
  }
  return { dates, values, values2 };
}

export function buildStaticPortfolioReturns(
  input: StaticPortfolioInput,
  priceSeriesByTicker: Record<string, Series>,
  benchmarkSeries: Record<string, Series>
): PortfolioReturnSeries {
  const tickers = input.holdings.map((h) => h.ticker);
  const weights = normalizeWeights(input.holdings.map((h) => h.weight));

  // Align asset price series by date using the first ticker as reference
  const reference = priceSeriesByTicker[tickers[0]];
  const portfolioReturnValues: number[] = [];
  const portfolioReturnDates: string[] = [];

  for (let i = 1; i < reference.values.length; i++) {
    const date = reference.dates[i];
    const prevDate = reference.dates[i - 1];
    const assetReturns: number[] = [];
    let skip = false;

    for (const ticker of tickers) {
      const series = priceSeriesByTicker[ticker];
      const idxCurrent = series.dates.indexOf(date);
      const idxPrev = series.dates.indexOf(prevDate);
      if (idxCurrent === -1 || idxPrev === -1) {
        skip = true;
        break;
      }
      const prev = series.values[idxPrev];
      const curr = series.values[idxCurrent];
      if (!isFinite(prev) || !isFinite(curr) || prev === 0) {
        skip = true;
        break;
      }
      assetReturns.push((curr - prev) / prev);
    }

    if (skip) continue;
    const portfolioReturn = assetReturns.reduce(
      (sum, r, idx) => sum + r * weights[idx],
      0
    );
    portfolioReturnDates.push(date);
    portfolioReturnValues.push(portfolioReturn);
  }

  const benchmark_returns: Record<string, number[]> = {};
  for (const [id, series] of Object.entries(benchmarkSeries)) {
    const returns = computeSimpleReturns(series);
    const aligned = alignReturnSeries({ dates: portfolioReturnDates, values: portfolioReturnValues }, returns);
    benchmark_returns[id] = aligned.values2;
  }

  return {
    dates: portfolioReturnDates,
    portfolio_returns: portfolioReturnValues,
    benchmark_returns,
  };
}

export function computePortfolioPerformanceFromSeries(
  input: StaticPortfolioInput,
  priceSeriesByTicker: Record<string, Series>,
  benchmarkSeries: Record<string, Series>
): PortfolioPerformanceResult {
  const returns = buildStaticPortfolioReturns(input, priceSeriesByTicker, benchmarkSeries);
  const portfolioSeries: Series = { dates: returns.dates, values: returns.portfolio_returns };
  const portfolioSummary = summarizeSeries(
    portfolioSeries,
    input.return_frequency,
    input.risk_free
  );

  const benchmarks: BenchmarkSummaryMetrics[] = [];
  for (const id of Object.keys(benchmarkSeries)) {
    const benchValues = returns.benchmark_returns[id] || [];
    const benchSeries: Series = { dates: returns.dates.slice(0, benchValues.length), values: benchValues };
    const benchSummary = summarizeSeries(benchSeries, input.return_frequency, input.risk_free);

    const relative_return =
      portfolioSummary.annualized_return !== null && benchSummary.annualized_return !== null
        ? portfolioSummary.annualized_return - benchSummary.annualized_return
        : null;

    const tracking_error = computeTrackingError(
      portfolioSeries,
      benchSeries,
      input.return_frequency
    );

    benchmarks.push({
      id,
      annualized_return: benchSummary.annualized_return,
      annualized_volatility: benchSummary.annualized_volatility,
      sharpe_ratio: benchSummary.sharpe_ratio,
      max_drawdown: benchSummary.max_drawdown,
      relative_return,
      tracking_error,
    });
  }

  return { portfolio: portfolioSummary, benchmarks };
}

