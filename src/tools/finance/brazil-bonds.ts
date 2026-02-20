import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatToolResult } from '../types.js';

/**
 * Tesouro Direto bond types as listed in Tesouro Transparente.
 *
 * Data sourced from:
 * https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto
 *
 * Bond type → canonical code mapping (aligned with dados-financeiros):
 *   Tesouro Selic        → LFT
 *   Tesouro Prefixado    → LTN
 *   Tesouro Prefixado c/ Juros Semestrais → NTN-F
 *   Tesouro IPCA+        → NTN-B-P
 *   Tesouro IPCA+ c/ Juros Semestrais     → NTN-B
 *   Tesouro IGPM+ c/ Juros Semestrais     → NTN-C
 *   Tesouro Renda+ Aposentadoria Extra    → NTN-R
 *   Tesouro Educa+       → NTN-E
 */

export const BOND_TYPE_DISPLAY_NAMES: Record<string, string> = {
  LFT:     'Tesouro Selic',
  LTN:     'Tesouro Prefixado',
  'NTN-F': 'Tesouro Prefixado com Juros Semestrais',
  'NTN-B-P': 'Tesouro IPCA+',
  'NTN-B': 'Tesouro IPCA+ com Juros Semestrais',
  'NTN-C': 'Tesouro IGPM+ com Juros Semestrais',
  'NTN-R': 'Tesouro Renda+ Aposentadoria Extra',
  'NTN-E': 'Tesouro Educa+',
};

// Transparente CSV URL (daily, from 2004-12-31)
const TRANSPARENTE_CSV_URL =
  'https://www.tesourotransparente.gov.br/ckan/dataset/' +
  'df56aa42-484a-4a59-8184-7676580c81e3/resource/' +
  '796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';

interface RawBondRow {
  bondType: string;        // e.g. "Tesouro IPCA+ com Juros Semestrais"
  maturityDate: string;    // dd/mm/yyyy
  tradeDate: string;       // dd/mm/yyyy
  buyRate: string;         // "6,49"
  sellRate: string;        // "6,49"
  buyPu: string;           // "1234,56"
  sellPu: string;          // "1234,56"
  basePu: string;          // "1234,56"
}

export interface BrazilBondPoint {
  bond_type: string;           // canonical code (e.g. "NTN-B")
  bond_name: string;           // display name
  asset_code: string;          // e.g. "NTN-B/2040"
  maturity_date: string;       // YYYY-MM-DD
  trade_date: string;          // YYYY-MM-DD
  buy_rate: number | null;     // decimal e.g. 0.0649 for 6.49%
  sell_rate: number | null;
  buy_pu: number | null;       // unit price in BRL
  sell_pu: number | null;
  base_pu: number | null;
}

const NAME_TO_CODE = Object.fromEntries(
  Object.entries(BOND_TYPE_DISPLAY_NAMES).map(([code, name]) => [name.toLowerCase(), code])
);

function parseBrDate(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.trim().split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function parseBrNumber(s: string): number | null {
  const v = parseFloat(s.replace(',', '.'));
  return isFinite(v) ? v : null;
}

function mapRow(row: RawBondRow): BrazilBondPoint | null {
  const code = NAME_TO_CODE[row.bondType.trim().toLowerCase()];
  if (!code) return null;

  const tradeDate = parseBrDate(row.tradeDate);
  const maturityDate = parseBrDate(row.maturityDate);
  if (!tradeDate || !maturityDate) return null;

  const maturityYear = maturityDate.slice(0, 4);
  const buyRate = parseBrNumber(row.buyRate);
  const sellRate = parseBrNumber(row.sellRate);
  const buyPu = parseBrNumber(row.buyPu);
  const sellPu = parseBrNumber(row.sellPu);
  const basePu = parseBrNumber(row.basePu);

  return {
    bond_type: code,
    bond_name: BOND_TYPE_DISPLAY_NAMES[code],
    asset_code: `${code}/${maturityYear}`,
    maturity_date: maturityDate,
    trade_date: tradeDate,
    buy_rate: buyRate !== null ? buyRate / 100 : null,
    sell_rate: sellRate !== null ? sellRate / 100 : null,
    buy_pu: buyPu,
    sell_pu: sellPu,
    base_pu: basePu,
  };
}

/**
 * Fetch and parse the Tesouro Transparente CSV, filtering rows by date and bond type.
 */
async function fetchBondData(
  startDate: string,
  endDate: string,
  bondTypeFilter?: string,
): Promise<{ points: BrazilBondPoint[]; sourceUrl: string }> {
  const response = await fetch(TRANSPARENTE_CSV_URL, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw new Error(`Tesouro Transparente CSV returned ${response.status}`);
  }
  const text = await response.text();

  // CSV columns (semicolon separated, Portuguese headers in row 1):
  // Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
  const lines = text.split('\n');
  const points: BrazilBondPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';');
    if (cols.length < 8) continue;

    const raw: RawBondRow = {
      bondType:    cols[0],
      maturityDate: cols[1],
      tradeDate:   cols[2],
      buyRate:     cols[3],
      sellRate:    cols[4],
      buyPu:       cols[5],
      sellPu:      cols[6],
      basePu:      cols[7],
    };

    const point = mapRow(raw);
    if (!point) continue;

    if (point.trade_date < startDate || point.trade_date > endDate) continue;
    if (bondTypeFilter && point.bond_type !== bondTypeFilter) continue;

    points.push(point);
  }

  return { points, sourceUrl: TRANSPARENTE_CSV_URL };
}

const BrazilBondsInputSchema = z.object({
  start_date: z.string().describe('Start date in YYYY-MM-DD format.'),
  end_date: z.string().describe('End date in YYYY-MM-DD format.'),
  bond_type: z
    .enum(['LFT', 'LTN', 'NTN-F', 'NTN-B-P', 'NTN-B', 'NTN-C', 'NTN-R', 'NTN-E'])
    .optional()
    .describe(
      'Optional filter by Tesouro Direto bond type. ' +
      'LFT = Tesouro Selic, LTN = Tesouro Prefixado, NTN-F = Tesouro Prefixado c/ Juros Semestrais, ' +
      'NTN-B-P = Tesouro IPCA+, NTN-B = Tesouro IPCA+ c/ Juros Semestrais, ' +
      'NTN-C = Tesouro IGPM+, NTN-R = Tesouro Renda+, NTN-E = Tesouro Educa+.'
    ),
});

export const getBrazilBonds = new DynamicStructuredTool({
  name: 'get_brazil_bonds',
  description:
    'Fetch daily Tesouro Direto (Brazilian government bond) prices and rates from Tesouro Transparente. ' +
    'Returns buy/sell rates and unit prices (PU) for LFT, LTN, NTN-B, NTN-F and other bond types.',
  schema: BrazilBondsInputSchema,
  func: async (input) => {
    const { points, sourceUrl } = await fetchBondData(
      input.start_date,
      input.end_date,
      input.bond_type,
    );
    return formatToolResult(
      {
        bonds: points,
        meta: {
          bond_types: BOND_TYPE_DISPLAY_NAMES,
          note: 'buy_rate and sell_rate are decimals (e.g. 0.065 = 6.5%). buy_pu/sell_pu are unit prices in BRL.',
        },
      },
      [sourceUrl],
    );
  },
});
