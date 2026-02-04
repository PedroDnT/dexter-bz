import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { isBrazilTicker, normalizeTicker, toYahooSymbol } from './market.js';
import { yfinanceNews } from './providers/yfinance.js';

export function filterNewsItemsByDate(
  items: Array<Record<string, unknown>>,
  startDate?: string,
  endDate?: string
): Array<Record<string, unknown>> {
  const start = startDate ? new Date(startDate).getTime() : null;
  const end = endDate ? new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1 : null;

  if (!start && !end) return items;

  const extractTime = (item: Record<string, unknown>): number | null => {
    const direct = item.providerPublishTime ?? item.publishTime ?? item.publishedAt ?? item.pubDate;
    if (typeof direct === 'number' && Number.isFinite(direct)) {
      return direct > 1e12 ? direct : direct * 1000;
    }
    if (typeof direct === 'string') {
      const time = Date.parse(direct);
      return Number.isFinite(time) ? time : null;
    }
    return null;
  };

  return items.filter((item) => {
    const time = extractTime(item);
    if (!time) return true;
    if (start !== null && time < start) return false;
    if (end !== null && time > end) return false;
    return true;
  });
}

const NewsInputSchema = z.object({
  ticker: z
    .string()
    .describe("The stock ticker symbol to fetch news for. For example, 'AAPL' for Apple."),
  start_date: z
    .string()
    .optional()
    .describe('The start date to fetch news from (YYYY-MM-DD).'),
  end_date: z.string().optional().describe('The end date to fetch news to (YYYY-MM-DD).'),
  limit: z
    .number()
    .default(10)
    .describe('The number of news articles to retrieve. Max is 100.'),
});

export const getNews = new DynamicStructuredTool({
  name: 'get_news',
  description: `Retrieves recent news articles for a given company ticker, covering financial announcements, market trends, and other significant events. Useful for staying up-to-date with market-moving information and investor sentiment.`,
  schema: NewsInputSchema,
  func: async (input) => {
    if (isBrazilTicker(input.ticker)) {
      const normalized = normalizeTicker(input.ticker);
      const symbol = toYahooSymbol(normalized.canonical);
      const news = (await yfinanceNews(symbol)) as Array<unknown>;
      const items = Array.isArray(news)
        ? (news.filter((n): n is Record<string, unknown> => Boolean(n && typeof n === 'object')))
        : [];
      const filtered = filterNewsItemsByDate(items, input.start_date, input.end_date);
      const limited = filtered.slice(0, input.limit);
      return formatToolResult(limited || [], ['https://finance.yahoo.com']);
    }
    const params: Record<string, string | number | undefined> = {
      ticker: input.ticker,
      limit: input.limit,
      start_date: input.start_date,
      end_date: input.end_date,
    };
    const { data, url } = await callApi('/news/', params);
    return formatToolResult(data.news || [], [url]);
  },
});
