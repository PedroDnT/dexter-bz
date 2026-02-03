import { shouldUseCvmFilings } from '../tools/finance/filings.js';

describe('CVM routing', () => {
  it('routes Brazil ticker to CVM', () => {
    expect(shouldUseCvmFilings('PETR4')).toBe(true);
    expect(shouldUseCvmFilings('PETR4.SA')).toBe(true);
  });

  it('routes Brazil filing types to CVM', () => {
    expect(shouldUseCvmFilings('AAPL', 'DFP')).toBe(true);
    expect(shouldUseCvmFilings('AAPL', 'ITR')).toBe(true);
  });

  it('keeps US tickers on SEC', () => {
    expect(shouldUseCvmFilings('AAPL', '10-K')).toBe(false);
  });
});
