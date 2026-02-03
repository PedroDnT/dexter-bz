import { selectLatestPtax } from '../tools/finance/providers/ptax.js';

describe('PTAX selection', () => {
  it('selects latest Fechamento rate', () => {
    const data = [
      { cotacaoVenda: 4.8, dataHoraCotacao: '2025-01-01T13:00:00-03:00', tipoBoletim: 'Fechamento' },
      { cotacaoVenda: 4.9, dataHoraCotacao: '2025-01-02T13:00:00-03:00', tipoBoletim: 'Fechamento' },
      { cotacaoVenda: 5.1, dataHoraCotacao: '2025-01-03T10:00:00-03:00', tipoBoletim: 'Abertura' },
    ];
    const latest = selectLatestPtax(data);
    expect(latest.usd_brl).toBe(4.9);
    expect(latest.timestamp).toBe('2025-01-02T13:00:00-03:00');
  });
});
