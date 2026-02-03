import { isBrazilTicker, normalizeTicker, toBrapiSymbol, toYahooSymbol } from '../../tools/finance/market.js';
import { yfinanceSearch } from '../../tools/finance/providers/yfinance.js';
import type { ResolvedTarget } from './types.js';

function looksLikeTickerCandidate(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  if (trimmed.length > 15) return false;
  return /^[A-Za-z0-9.\-]+$/.test(trimmed);
}

function pickBestYahooSearchSymbol(searchResult: unknown): { symbol: string; label?: string } | null {
  if (!searchResult || typeof searchResult !== 'object') return null;
  const quotes = (searchResult as { quotes?: unknown }).quotes;
  if (!Array.isArray(quotes)) return null;

  const candidates = quotes
    .filter((quote): quote is Record<string, unknown> => Boolean(quote && typeof quote === 'object'))
    .map((quote) => {
      const symbol = typeof quote.symbol === 'string' ? quote.symbol : null;
      const typeDisp = typeof quote.typeDisp === 'string' ? quote.typeDisp : '';
      const exchDisp = typeof quote.exchDisp === 'string' ? quote.exchDisp : '';
      const shortname = typeof quote.shortname === 'string' ? quote.shortname : '';
      const longname = typeof quote.longname === 'string' ? quote.longname : '';
      const score = [
        symbol ? 1 : 0,
        typeDisp === 'Equity' ? 2 : 0,
        exchDisp ? 1 : 0,
        shortname || longname ? 1 : 0,
      ].reduce((a, b) => a + b, 0);
      if (!symbol) return null;
      const label = longname || shortname || undefined;
      return label ? { symbol, label, score } : { symbol, score };
    })
    .filter((c): c is { symbol: string; label?: string; score: number } => Boolean(c));

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { symbol: candidates[0].symbol, label: candidates[0].label };
}

export async function resolveTarget(query: string): Promise<ResolvedTarget> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Empty target query');
  }

  if (isBrazilTicker(trimmed)) {
    const normalized = normalizeTicker(trimmed);
    const canonical = normalized.canonical;
    return {
      query: trimmed,
      label: canonical,
      ticker: canonical,
      market: 'BR',
      yahooSymbol: toYahooSymbol(canonical),
      brapiSymbol: toBrapiSymbol(canonical),
      resolvedFrom: 'ticker',
    };
  }

  if (looksLikeTickerCandidate(trimmed)) {
    const ticker = trimmed.toUpperCase();

    // For ambiguous inputs (e.g., company names that look like tickers), prefer Yahoo search when available.
    if (/^[A-Za-z]{3,10}$/.test(trimmed)) {
      try {
        const search = await yfinanceSearch(trimmed);
        const picked = pickBestYahooSearchSymbol(search);
        if (picked?.symbol) {
          if (isBrazilTicker(picked.symbol)) {
            const normalized = normalizeTicker(picked.symbol);
            const canonical = normalized.canonical;
            return {
              query: trimmed,
              label: picked.label || canonical,
              ticker: canonical,
              market: 'BR',
              yahooSymbol: toYahooSymbol(canonical),
              brapiSymbol: toBrapiSymbol(canonical),
              resolvedFrom: 'yfinance_search',
            };
          }
          const usTicker = picked.symbol.toUpperCase();
          return {
            query: trimmed,
            label: picked.label || usTicker,
            ticker: usTicker,
            market: 'US',
            resolvedFrom: 'yfinance_search',
          };
        }
      } catch {
        // fall back to treating as ticker
      }
    }

    return {
      query: trimmed,
      label: ticker,
      ticker,
      market: 'US',
      resolvedFrom: 'ticker',
    };
  }

  const search = await yfinanceSearch(trimmed);
  const picked = pickBestYahooSearchSymbol(search);
  if (!picked) {
    throw new Error(`No Yahoo Finance search results for: ${trimmed}`);
  }

  if (isBrazilTicker(picked.symbol)) {
    const normalized = normalizeTicker(picked.symbol);
    const canonical = normalized.canonical;
    return {
      query: trimmed,
      label: picked.label || canonical,
      ticker: canonical,
      market: 'BR',
      yahooSymbol: toYahooSymbol(canonical),
      brapiSymbol: toBrapiSymbol(canonical),
      resolvedFrom: 'yfinance_search',
    };
  }

  const usTicker = picked.symbol.toUpperCase();
  return {
    query: trimmed,
    label: picked.label || usTicker,
    ticker: usTicker,
    market: 'US',
    resolvedFrom: 'yfinance_search',
  };
}
