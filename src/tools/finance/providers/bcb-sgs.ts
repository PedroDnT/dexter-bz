/**
 * Banco Central do Brasil – Statistical Series System (SGS)
 * Public JSON API, no authentication required.
 *
 * Series IDs sourced from https://github.com/Tpessia/dados-financeiros
 */

import { fetchJson } from '../../../utils/http.js';

export interface BcbSgsPoint {
  date: string;  // YYYY-MM-DD
  value: number;
}

export interface BcbSgsResult {
  series_id: number;
  series_label: string;
  frequency: 'daily' | 'monthly';
  unit: string;
  points: BcbSgsPoint[];
  source_url: string;
}

// Map of well-known series: label, frequency, unit
const SERIES_META: Record<number, { label: string; frequency: 'daily' | 'monthly'; unit: string }> = {
  11:    { label: 'Selic',       frequency: 'daily',   unit: '%/day' },
  12:    { label: 'CDI',         frequency: 'daily',   unit: '%/day' },
  189:   { label: 'IGP-M',       frequency: 'monthly', unit: '%/month' },
  226:   { label: 'TR',          frequency: 'monthly', unit: '%/month' },
  433:   { label: 'IPCA',        frequency: 'monthly', unit: '%/month' },
  4390:  { label: 'Selic',       frequency: 'monthly', unit: '%/month' },
  4391:  { label: 'CDI',         frequency: 'monthly', unit: '%/month' },
  7478:  { label: 'IPCA-15',     frequency: 'monthly', unit: '%/month' },
  12466: { label: 'IMA-B',       frequency: 'daily',   unit: 'index' },
  12467: { label: 'IMA-B 5',     frequency: 'daily',   unit: 'index' },
  12468: { label: 'IMA-B 5+',    frequency: 'daily',   unit: 'index' },
};

interface BcbRawPoint {
  data: string;    // "dd/mm/yyyy"
  valor: string;   // numeric string
}

function formatDdMmYyyy(isoDate: string): string {
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

function parseDdMmYyyy(ddmmyyyy: string): string {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Fetch a BCB SGS time series for the given date range.
 *
 * @param seriesId - BCB SGS numeric series identifier
 * @param startDate - start date in YYYY-MM-DD format
 * @param endDate   - end date in YYYY-MM-DD format
 */
export async function fetchBcbSgs(
  seriesId: number,
  startDate: string,
  endDate: string,
): Promise<BcbSgsResult> {
  const dataInicial = formatDdMmYyyy(startDate);
  const dataFinal = formatDdMmYyyy(endDate);

  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados` +
    `?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;

  const raw = await fetchJson<BcbRawPoint[]>(url, 15000);
  if (!Array.isArray(raw)) {
    throw new Error(`BCB SGS: unexpected response shape for series ${seriesId}`);
  }

  const points: BcbSgsPoint[] = [];
  for (const item of raw) {
    const v = parseFloat(item.valor?.replace(',', '.'));
    if (!isFinite(v)) continue;
    points.push({ date: parseDdMmYyyy(item.data), value: v });
  }

  const meta = SERIES_META[seriesId] ?? {
    label: `Series ${seriesId}`,
    frequency: 'daily' as const,
    unit: '',
  };

  return {
    series_id: seriesId,
    series_label: meta.label,
    frequency: meta.frequency,
    unit: meta.unit,
    points,
    source_url: url,
  };
}

/**
 * Named aliases → BCB SGS series ID mappings used by the macro-series tool.
 */
export const BCB_SERIES_IDS: Record<string, number> = {
  igpm:      189,
  tr:        226,
  imab:      12466,
  imab5:     12467,
  imab5plus: 12468,
};
