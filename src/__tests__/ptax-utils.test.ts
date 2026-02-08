import { describe, it, expect } from 'bun:test';
import { selectLatestPtax, convertBrlToUsd, addUsdFields } from '../tools/finance/providers/ptax.js';

describe('selectLatestPtax', () => {
  it('prefers Fechamento over other bulletin types', () => {
    const rate = selectLatestPtax([
      { cotacaoVenda: 5.0, dataHoraCotacao: '2025-01-01T10:00:00', tipoBoletim: 'Abertura' },
      { cotacaoVenda: 5.1, dataHoraCotacao: '2025-01-01T13:00:00', tipoBoletim: 'Fechamento' },
    ]);
    expect(rate.usd_brl).toBe(5.1);
  });

  it('selects latest by timestamp when multiple Fechamento rates', () => {
    const rate = selectLatestPtax([
      { cotacaoVenda: 5.0, dataHoraCotacao: '2025-01-01T13:00:00', tipoBoletim: 'Fechamento' },
      { cotacaoVenda: 5.2, dataHoraCotacao: '2025-01-02T13:00:00', tipoBoletim: 'Fechamento' },
      { cotacaoVenda: 5.1, dataHoraCotacao: '2025-01-01T18:00:00', tipoBoletim: 'Fechamento' },
    ]);
    expect(rate.usd_brl).toBe(5.2);
    expect(rate.timestamp).toBe('2025-01-02T13:00:00');
  });

  it('falls back to non-Fechamento rates when no Fechamento available', () => {
    const rate = selectLatestPtax([
      { cotacaoVenda: 4.9, dataHoraCotacao: '2025-01-01T10:00:00', tipoBoletim: 'Abertura' },
      { cotacaoVenda: 5.0, dataHoraCotacao: '2025-01-02T10:00:00', tipoBoletim: 'Intermediário' },
    ]);
    expect(rate.usd_brl).toBe(5.0);
  });

  it('throws when no items have cotacaoVenda', () => {
    expect(() =>
      selectLatestPtax([
        { dataHoraCotacao: '2025-01-01T13:00:00', tipoBoletim: 'Fechamento' },
        { cotacaoVenda: 0, dataHoraCotacao: '2025-01-01T13:00:00', tipoBoletim: 'Fechamento' },
      ])
    ).toThrow('PTAX: no valid cotacaoVenda found');
  });

  it('throws when items array is empty', () => {
    expect(() => selectLatestPtax([])).toThrow('PTAX: no valid cotacaoVenda found');
  });

  it('throws when candidates have no dataHoraCotacao', () => {
    expect(() =>
      selectLatestPtax([{ cotacaoVenda: 5.0, tipoBoletim: 'Fechamento' }])
    ).toThrow();
  });

  it('sets sourceUrl to empty string', () => {
    const rate = selectLatestPtax([
      { cotacaoVenda: 5.1, dataHoraCotacao: '2025-01-01T13:00:00', tipoBoletim: 'Fechamento' },
    ]);
    expect(rate.sourceUrl).toBe('');
  });
});

describe('convertBrlToUsd', () => {
  it('converts BRL to USD correctly', () => {
    expect(convertBrlToUsd(100, 5.0)).toBe(20);
    expect(convertBrlToUsd(500, 5.0)).toBe(100);
  });

  it('returns original value when usdBrl is zero', () => {
    expect(convertBrlToUsd(100, 0)).toBe(100);
  });

  it('returns original value when value is Infinity', () => {
    expect(convertBrlToUsd(Infinity, 5.0)).toBe(Infinity);
  });

  it('returns original value when usdBrl is Infinity', () => {
    expect(convertBrlToUsd(100, Infinity)).toBe(100);
  });

  it('returns original value when value is NaN', () => {
    expect(convertBrlToUsd(NaN, 5.0)).toBeNaN();
  });

  it('handles negative values correctly', () => {
    expect(convertBrlToUsd(-100, 5.0)).toBe(-20);
  });
});

describe('addUsdFields', () => {
  it('adds _usd suffix fields for specified numeric fields', () => {
    const record = { price: 100, volume: 50000, name: 'Petrobras' };
    const result = addUsdFields(record, ['price', 'volume'], 5.0);
    expect(result.price_usd).toBe(20);
    expect(result.volume_usd).toBe(10000);
    expect(result.name).toBe('Petrobras');
  });

  it('skips non-numeric fields', () => {
    const record = { price: 100, name: 'test', status: null };
    const result = addUsdFields(record, ['price', 'name', 'status'], 5.0);
    expect(result.price_usd).toBe(20);
    expect(result.name_usd).toBeUndefined();
    expect(result.status_usd).toBeUndefined();
  });

  it('skips non-finite numeric fields', () => {
    const record = { price: Infinity, volume: NaN };
    const result = addUsdFields(record, ['price', 'volume'], 5.0);
    expect(result.price_usd).toBeUndefined();
    expect(result.volume_usd).toBeUndefined();
  });

  it('preserves all original fields', () => {
    const record = { a: 1, b: 'text', c: true };
    const result = addUsdFields(record, ['a'], 5.0);
    expect(result.a).toBe(1);
    expect(result.b).toBe('text');
    expect(result.c).toBe(true);
  });

  it('handles empty fields array', () => {
    const record = { price: 100 };
    const result = addUsdFields(record, [], 5.0);
    expect(result.price_usd).toBeUndefined();
    expect(result.price).toBe(100);
  });
});
