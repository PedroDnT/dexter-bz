import { describe, it, expect } from 'bun:test';
import { BOND_TYPE_DISPLAY_NAMES } from '../tools/finance/brazil-bonds.js';

describe('brazil-bonds helpers', () => {
  describe('BOND_TYPE_DISPLAY_NAMES', () => {
    it('maps all expected canonical codes to display names', () => {
      expect(BOND_TYPE_DISPLAY_NAMES['LFT']).toBe('Tesouro Selic');
      expect(BOND_TYPE_DISPLAY_NAMES['LTN']).toBe('Tesouro Prefixado');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-F']).toBe('Tesouro Prefixado com Juros Semestrais');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-B-P']).toBe('Tesouro IPCA+');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-B']).toBe('Tesouro IPCA+ com Juros Semestrais');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-C']).toBe('Tesouro IGPM+ com Juros Semestrais');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-R']).toBe('Tesouro Renda+ Aposentadoria Extra');
      expect(BOND_TYPE_DISPLAY_NAMES['NTN-E']).toBe('Tesouro Educa+');
    });

    it('covers all 8 main Tesouro Direto bond types', () => {
      expect(Object.keys(BOND_TYPE_DISPLAY_NAMES)).toHaveLength(8);
    });
  });
});
