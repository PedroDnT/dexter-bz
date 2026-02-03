import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toBrapiSymbol, toYahooSymbol } from './market.js';
import { getBrapiQuote } from './providers/brapi.js';
import { yfinanceInfo } from './providers/yfinance.js';
import { getLatestPtax, addUsdFields } from './providers/ptax.js';

const CompanyFactsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch company facts for. For example, 'AAPL' for Apple."),
});

export const getCompanyFacts = new DynamicStructuredTool({
  name: 'get_company_facts',
  description: `Retrieves company facts and metadata for a given ticker, including sector, industry, market cap, number of employees, listing date, exchange, location, weighted average shares,  website. Useful for getting an overview of a company's profile and basic information.`,
  schema: CompanyFactsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toBrapiSymbol(normalized.canonical);
      const yahooSymbol = toYahooSymbol(normalized.canonical);
      const ptax = await getLatestPtax();
      let result: Record<string, unknown> = {};
      let sourceUrls: string[] = [ptax.sourceUrl];

      try {
        const { data, url } = await getBrapiQuote([symbol], { modules: ['summaryProfile', 'price', 'summaryDetail'] });
        sourceUrls.push(url);
        const quote = Array.isArray((data as { results?: unknown[] }).results)
          ? (data as { results?: unknown[] }).results?.[0] as Record<string, unknown>
          : {};
        result = {
          symbol,
          sector: quote?.sector ?? null,
          industry: quote?.industry ?? null,
          market_cap: quote?.marketCap ?? null,
          employees: quote?.fullTimeEmployees ?? null,
          exchange: quote?.exchange ?? null,
          location: quote?.city ?? null,
          website: quote?.website ?? null,
          currency: quote?.currency ?? 'BRL',
          shares_outstanding: quote?.sharesOutstanding ?? null,
        };
      } catch {
        const info = await yfinanceInfo(yahooSymbol) as Record<string, unknown>;
        result = {
          symbol,
          sector: info.sector ?? null,
          industry: info.industry ?? null,
          market_cap: info.marketCap ?? null,
          employees: info.fullTimeEmployees ?? null,
          exchange: info.exchange ?? null,
          location: info.city ?? null,
          website: info.website ?? null,
          currency: info.currency ?? 'BRL',
          shares_outstanding: info.sharesOutstanding ?? null,
        };
      }

      const withUsd = addUsdFields(result as Record<string, unknown>, ['market_cap'], ptax.usd_brl);
      return formatToolResult({ ...withUsd, fx: ptax }, sourceUrls);
    }

    const { data, url } = await callApi('/company/facts', { ticker: input.ticker });
    return formatToolResult(data.company_facts || {}, [url]);
  },
});
