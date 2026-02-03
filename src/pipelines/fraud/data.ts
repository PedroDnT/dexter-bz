import {
  getBalanceSheets,
  getCashFlowStatements,
  getCompanyFacts,
  getFilings,
  getIncomeStatements,
  getKeyRatiosSnapshot,
  getPriceSnapshot,
  getPrices,
} from '../../tools/finance/index.js';
import type { ToolResult } from '../../tools/types.js';
import type { FetchError, FraudDataset, ResolvedTarget } from './types.js';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function parseToolResult(result: unknown): { data: unknown; sourceUrls: string[] } {
  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result) as ToolResult;
      const sourceUrls = Array.isArray(parsed?.sourceUrls) ? parsed.sourceUrls : [];
      return { data: parsed?.data, sourceUrls };
    } catch {
      return { data: result, sourceUrls: [] };
    }
  }

  if (result && typeof result === 'object' && 'data' in (result as Record<string, unknown>)) {
    const typed = result as ToolResult;
    const sourceUrls = Array.isArray(typed?.sourceUrls) ? typed.sourceUrls : [];
    return { data: typed?.data, sourceUrls };
  }

  return { data: result, sourceUrls: [] };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asArrayOfRecords(value: unknown): Array<Record<string, unknown>> | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item))
  );
}

function extractArray(value: unknown, key: string): Array<Record<string, unknown>> | undefined {
  const direct = asArrayOfRecords(value);
  if (direct) return direct;
  const record = asRecord(value);
  if (!record) return undefined;
  return asArrayOfRecords(record[key]);
}

function isoDateDaysAgo(days: number): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days);
  return start.toISOString().slice(0, 10);
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface FraudDataOptions {
  lookbackDays?: number;
  statementsLimit?: number;
  filingsLimit?: number;
}

export async function gatherFraudDataset(
  target: ResolvedTarget,
  options: FraudDataOptions = {}
): Promise<{ dataset: FraudDataset; sources: string[]; errors: FetchError[] }> {
  const lookbackDays = options.lookbackDays ?? 365 * 2;
  const statementsLimit = options.statementsLimit ?? 6;
  const filingsLimit = options.filingsLimit ?? 20;

  const startDate = isoDateDaysAgo(lookbackDays);
  const endDate = isoToday();

  const steps: Array<{
    key: keyof FraudDataset;
    stepName: string;
    run: () => Promise<unknown>;
  }> = [
    {
      key: 'companyFacts',
      stepName: 'company_facts',
      run: () => getCompanyFacts.invoke({ ticker: target.ticker }),
    },
    {
      key: 'priceSnapshot',
      stepName: 'price_snapshot',
      run: () => getPriceSnapshot.invoke({ ticker: target.ticker }),
    },
    {
      key: 'prices',
      stepName: 'prices_history',
      run: () =>
        getPrices.invoke({
          ticker: target.ticker,
          interval: 'day',
          interval_multiplier: 1,
          start_date: startDate,
          end_date: endDate,
        }),
    },
    {
      key: 'incomeStatements',
      stepName: 'income_statements',
      run: () =>
        getIncomeStatements.invoke({
          ticker: target.ticker,
          period: 'annual',
          limit: statementsLimit,
        }),
    },
    {
      key: 'balanceSheets',
      stepName: 'balance_sheets',
      run: () =>
        getBalanceSheets.invoke({
          ticker: target.ticker,
          period: 'annual',
          limit: statementsLimit,
        }),
    },
    {
      key: 'cashFlowStatements',
      stepName: 'cash_flow_statements',
      run: () =>
        getCashFlowStatements.invoke({
          ticker: target.ticker,
          period: 'annual',
          limit: statementsLimit,
        }),
    },
    {
      key: 'keyRatiosSnapshot',
      stepName: 'key_ratios_snapshot',
      run: () => getKeyRatiosSnapshot.invoke({ ticker: target.ticker }),
    },
    {
      key: 'filings',
      stepName: 'filings',
      run: () => getFilings.invoke({ ticker: target.ticker, limit: filingsLimit }),
    },
  ];

  const errors: FetchError[] = [];
  const sources = new Set<string>();
  const dataset: FraudDataset = {};

  const executions = steps.map(async (step) => {
    try {
      const result = await step.run();
      const parsed = parseToolResult(result);
      parsed.sourceUrls.forEach((url) => sources.add(url));
      return { step, data: parsed.data };
    } catch (error) {
      errors.push({ step: step.stepName, error: toErrorMessage(error) });
      return { step, data: undefined };
    }
  });

  const results = await Promise.all(executions);

  for (const result of results) {
    const { step, data } = result;

    if (step.key === 'companyFacts') {
      dataset.companyFacts = asRecord(data);
      continue;
    }
    if (step.key === 'priceSnapshot') {
      const snapshot = asRecord(data);
      dataset.priceSnapshot = snapshot;
      const fx = snapshot?.fx;
      if (fx && typeof fx === 'object' && 'usd_brl' in (fx as Record<string, unknown>)) {
        dataset.fx = fx as FraudDataset['fx'];
      }
      dataset.currency =
        typeof snapshot?.currency === 'string' ? snapshot.currency : dataset.currency;
      continue;
    }
    if (step.key === 'prices') {
      const prices = extractArray(data, 'prices') ?? asArrayOfRecords(data);
      dataset.prices = prices;
      const record = asRecord(data);
      const fx = record?.fx;
      if (
        !dataset.fx &&
        fx &&
        typeof fx === 'object' &&
        'usd_brl' in (fx as Record<string, unknown>)
      ) {
        dataset.fx = fx as FraudDataset['fx'];
      }
      if (!dataset.currency && typeof record?.currency === 'string') {
        dataset.currency = record.currency;
      }
      continue;
    }
    if (step.key === 'incomeStatements') {
      dataset.incomeStatements =
        extractArray(data, 'income_statements') ??
        extractArray(data, 'incomeStatements') ??
        asArrayOfRecords(data);
      const record = asRecord(data);
      const fx = record?.fx;
      if (
        !dataset.fx &&
        fx &&
        typeof fx === 'object' &&
        'usd_brl' in (fx as Record<string, unknown>)
      ) {
        dataset.fx = fx as FraudDataset['fx'];
      }
      if (!dataset.currency && typeof record?.currency === 'string') {
        dataset.currency = record.currency;
      }
      continue;
    }
    if (step.key === 'balanceSheets') {
      dataset.balanceSheets =
        extractArray(data, 'balance_sheets') ??
        extractArray(data, 'balanceSheets') ??
        asArrayOfRecords(data);
      const record = asRecord(data);
      const fx = record?.fx;
      if (
        !dataset.fx &&
        fx &&
        typeof fx === 'object' &&
        'usd_brl' in (fx as Record<string, unknown>)
      ) {
        dataset.fx = fx as FraudDataset['fx'];
      }
      if (!dataset.currency && typeof record?.currency === 'string') {
        dataset.currency = record.currency;
      }
      continue;
    }
    if (step.key === 'cashFlowStatements') {
      dataset.cashFlowStatements =
        extractArray(data, 'cash_flow_statements') ??
        extractArray(data, 'cashFlowStatements') ??
        asArrayOfRecords(data);
      const record = asRecord(data);
      const fx = record?.fx;
      if (
        !dataset.fx &&
        fx &&
        typeof fx === 'object' &&
        'usd_brl' in (fx as Record<string, unknown>)
      ) {
        dataset.fx = fx as FraudDataset['fx'];
      }
      if (!dataset.currency && typeof record?.currency === 'string') {
        dataset.currency = record.currency;
      }
      continue;
    }
    if (step.key === 'keyRatiosSnapshot') {
      dataset.keyRatiosSnapshot = asRecord(data);
      continue;
    }
    if (step.key === 'filings') {
      dataset.filings = asArrayOfRecords(data) ?? extractArray(data, 'filings');
      continue;
    }
  }

  if (!dataset.currency) {
    const factsCurrency = dataset.companyFacts?.currency;
    if (typeof factsCurrency === 'string') dataset.currency = factsCurrency;
  }

  return { dataset, sources: [...sources].sort(), errors };
}

