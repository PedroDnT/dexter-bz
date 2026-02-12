import { describe, it, expect } from 'bun:test';
import { isBrazilTicker, normalizeTicker, toBrapiSymbol, toYahooSymbol } from '../tools/finance/market.js';

describe('isBrazilTicker', () => {
  it('detects standard B3 tickers (4 letters + 1 digit)', () => {
    expect(isBrazilTicker('PETR4')).toBe(true);
    expect(isBrazilTicker('VALE3')).toBe(true);
    expect(isBrazilTicker('ITUB4')).toBe(true);
    expect(isBrazilTicker('BBDC4')).toBe(true);
  });

  it('detects B3 tickers with 2-digit suffix', () => {
    expect(isBrazilTicker('PETR11')).toBe(true);
    expect(isBrazilTicker('BOVA11')).toBe(true);
  });

  it('detects Yahoo-style .SA suffix', () => {
    expect(isBrazilTicker('PETR4.SA')).toBe(true);
    expect(isBrazilTicker('VALE3.SA')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isBrazilTicker('petr4')).toBe(true);
    expect(isBrazilTicker('Petr4.sa')).toBe(true);
  });

  it('rejects US tickers', () => {
    expect(isBrazilTicker('AAPL')).toBe(false);
    expect(isBrazilTicker('MSFT')).toBe(false);
    expect(isBrazilTicker('GOOGL')).toBe(false);
  });

  it('rejects tickers with too few letters', () => {
    expect(isBrazilTicker('AB1')).toBe(false);
    expect(isBrazilTicker('XY3')).toBe(false);
  });

  it('rejects tickers with too many letters', () => {
    expect(isBrazilTicker('ABCDE4')).toBe(false);
  });

  it('rejects tickers with no digits', () => {
    expect(isBrazilTicker('PETR')).toBe(false);
  });

  it('handles whitespace', () => {
    expect(isBrazilTicker('  PETR4  ')).toBe(true);
  });
});

describe('normalizeTicker', () => {
  it('normalizes B3 tickers to canonical form', () => {
    const result = normalizeTicker('petr4.sa');
    expect(result.canonical).toBe('PETR4');
    expect(result.market).toBe('BR');
    expect(result.yahooSymbol).toBe('PETR4.SA');
    expect(result.brapiSymbol).toBe('PETR4');
  });

  it('normalizes B3 tickers without .SA suffix', () => {
    const result = normalizeTicker('vale3');
    expect(result.canonical).toBe('VALE3');
    expect(result.market).toBe('BR');
  });

  it('identifies US tickers', () => {
    const result = normalizeTicker('aapl');
    expect(result.canonical).toBe('AAPL');
    expect(result.market).toBe('US');
    expect(result.yahooSymbol).toBeUndefined();
    expect(result.brapiSymbol).toBeUndefined();
  });

  it('identifies crypto tickers', () => {
    const result = normalizeTicker('CRYPTO-USD');
    expect(result.canonical).toBe('CRYPTO-USD');
    expect(result.market).toBe('CRYPTO');
  });

  it('preserves raw input', () => {
    const result = normalizeTicker('  Petr4.SA  ');
    expect(result.raw).toBe('Petr4.SA');
  });
});

describe('toBrapiSymbol', () => {
  it('strips .SA and uppercases', () => {
    expect(toBrapiSymbol('PETR4.SA')).toBe('PETR4');
    expect(toBrapiSymbol('PETR4')).toBe('PETR4');
    expect(toBrapiSymbol('vale3')).toBe('VALE3');
  });
});

describe('toYahooSymbol', () => {
  it('appends .SA suffix', () => {
    expect(toYahooSymbol('PETR4')).toBe('PETR4.SA');
    expect(toYahooSymbol('PETR4.SA')).toBe('PETR4.SA');
  });

  it('uppercases the ticker', () => {
    expect(toYahooSymbol('vale3')).toBe('VALE3.SA');
  });
});
