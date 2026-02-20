import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { callApi } from './api.js';
import { formatToolResult } from '../types.js';

const MacroSeriesInputSchema = z.object({
  series_id: z
    .enum(['ipca', 'ipca15', 'cdi', 'selic'])
    .describe(
      "Identifier of the macro series to fetch: 'ipca' (official Brazilian inflation), 'ipca15' (preview inflation), 'cdi' (interbank rate), or 'selic' (policy rate)."
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
    .describe('Desired frequency of the series (daily or monthly). Defaults to monthly.'),
});

export const getMacroSeries = new DynamicStructuredTool({
  name: 'get_macro_series',
  description:
    'Fetch Brazilian macroeconomic time series such as IPCA, IPCA-15, CDI, and Selic for a given date range.',
  schema: MacroSeriesInputSchema,
  func: async (input) => {
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
