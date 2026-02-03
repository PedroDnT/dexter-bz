import { isBrazilTicker, normalizeTicker } from '../tools/finance/market.js';

describe('Brazil ticker detection', () => {
  it('detects B3 tickers', () => {
    expect(isBrazilTicker('PETR4')).toBe(true);
    expect(isBrazilTicker('PETR4.SA')).toBe(true);
    expect(isBrazilTicker('AAPL')).toBe(false);
  });

  it('normalizes B3 tickers', () => {
    const normalized = normalizeTicker('petr4.sa');
    expect(normalized.market).toBe('BR');
    expect(normalized.canonical).toBe('PETR4');
    expect(normalized.yahooSymbol).toBe('PETR4.SA');
  });
});
