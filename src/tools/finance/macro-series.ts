import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';
import { fetchBcbSgs, BCB_SERIES_IDS } from './providers/bcb-sgs.js';

// Series routed to financialdatasets.ai backend
const FINANCIAL_DATASETS_SERIES = ['ipca', 'ipca15', 'cdi', 'selic'] as const;

// Series fetched directly from BCB SGS (Banco Central do Brasil)
const BCB_SERIES = ['igpm', 'tr', 'imab', 'imab5', 'imab5plus'] as const;

const MacroSeriesInputSchema = z.object({
  series_id: z
    .enum([...FINANCIAL_DATASETS_SERIES, ...BCB_SERIES])
    .describe(
      "Identifier of the macro series to fetch. " +
      "Rate series: 'ipca' (official Brazilian inflation, monthly), 'ipca15' (preview inflation, monthly), " +
      "'cdi' (interbank rate), 'selic' (policy rate), 'igpm' (broad inflation IGP-M, monthly), " +
      "'tr' (reference rate TR, monthly). " +
      "Bond index series (daily, from BCB): 'imab' (IMA-B, IPCA-linked bonds), " +
      "'imab5' (IMA-B 5, short IPCA-linked bonds ≤5y), 'imab5plus' (IMA-B 5+, long IPCA-linked bonds >5y)."
    ),
  start_date: z
    .string()
    .describe('Start date for the series in YYYY-MM-DD format.'),
  end_date: z
    .string()
    .describe('End date for the series in YYYY-MM-DD format.'),
  frequency: z
    .enum(['daily', 'monthly'])
    .default('monthly')
    .describe('Desired frequency of the series (daily or monthly). Defaults to monthly. Note: igpm and tr are monthly-only; imab/imab5/imab5plus are daily-only.'),
});

export const getMacroSeries = new DynamicStructuredTool({
  name: 'get_macro_series',
  description:
    'Fetch Brazilian macroeconomic time series including IPCA, IPCA-15, CDI, Selic, IGP-M, TR, and IMA-B bond indices for a given date range.',
  schema: MacroSeriesInputSchema,
  func: async (input) => {
    const isBcbSeries = (BCB_SERIES as readonly string[]).includes(input.series_id);

    if (isBcbSeries) {
      const seriesId = BCB_SERIES_IDS[input.series_id];
      const result = await fetchBcbSgs(seriesId, input.start_date, input.end_date);
      return formatToolResult(
        { series: result.points, meta: { label: result.series_label, unit: result.unit, frequency: result.frequency } },
        [result.source_url]
      );
    }

    const params = {
      series_id: input.series_id,
      start_date: input.start_date,
      end_date: input.end_date,
      frequency: input.frequency,
    };

    const { data, url } = await callApi('/macro/series/', params);

    // Expect the backend to normalize into { series: [{ date, value, ... }], meta?: {...} }
    // but fall back to returning data as-is if no series wrapper exists.
    const payload =
      data && typeof data === 'object' && 'series' in data
        ? (data as { series: unknown }).series
        : data;

    return formatToolResult(payload, [url]);
  },
});
