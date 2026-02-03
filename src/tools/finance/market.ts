export type Market = 'US' | 'BR' | 'CRYPTO' | 'UNKNOWN';

export interface NormalizedTicker {
  raw: string;
  canonical: string;
  market: Market;
  yahooSymbol?: string;
  brapiSymbol?: string;
}

const B3_TICKER_REGEX = /^[A-Z]{4}\d{1,2}$/;

export function isBrazilTicker(input: string): boolean {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.endsWith('.SA')) return true;
  const base = trimmed.replace(/\.SA$/, '');
  return B3_TICKER_REGEX.test(base);
}

export function normalizeTicker(input: string): NormalizedTicker {
  const raw = input.trim();
  const upper = raw.toUpperCase();

  if (upper.startsWith('CRYPTO-')) {
    return { raw, canonical: upper, market: 'CRYPTO' };
  }

  if (isBrazilTicker(upper)) {
    const base = upper.replace(/\.SA$/, '');
    return {
      raw,
      canonical: base,
      market: 'BR',
      yahooSymbol: `${base}.SA`,
      brapiSymbol: base,
    };
  }

  return { raw, canonical: upper, market: 'US' };
}

export function toBrapiSymbol(canonicalBr: string): string {
  return canonicalBr.toUpperCase().replace(/\.SA$/, '');
}

export function toYahooSymbol(canonicalBr: string): string {
  const base = canonicalBr.toUpperCase().replace(/\.SA$/, '');
  return `${base}.SA`;
}
