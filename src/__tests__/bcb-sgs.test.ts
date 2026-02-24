import { describe, it, expect } from 'bun:test';
import { fetchBcbSgs, BCB_SERIES_IDS } from '../tools/finance/providers/bcb-sgs.js';

// Unit tests for the BCB SGS provider logic (offline / parser tests)

describe('BCB SGS provider', () => {
  describe('BCB_SERIES_IDS mapping', () => {
    it('contains all expected series aliases', () => {
      expect(BCB_SERIES_IDS['igpm']).toBe(189);
      expect(BCB_SERIES_IDS['tr']).toBe(226);
      expect(BCB_SERIES_IDS['imab']).toBe(12466);
      expect(BCB_SERIES_IDS['imab5']).toBe(12467);
      expect(BCB_SERIES_IDS['imab5plus']).toBe(12468);
    });
  });

  describe('date format helpers (via fetchBcbSgs URL construction)', () => {
    it('builds correct URL with dd/mm/yyyy dates', async () => {
      // We mock fetch to capture the URL
      const capturedUrls: string[] = [];
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async (url: string) => {
        capturedUrls.push(url as string);
        // Return a valid empty array response
        return {
          ok: true,
          json: async () => [],
        };
      }) as unknown as typeof fetch;

      try {
        await fetchBcbSgs(189, '2023-01-01', '2023-06-30');
        expect(capturedUrls.length).toBe(1);
        const url = capturedUrls[0];
        expect(url).toContain('bcdata.sgs.189');
        expect(url).toContain('dataInicial=01/01/2023');
        expect(url).toContain('dataFinal=30/06/2023');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('returns empty points array for empty BCB response', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => [],
      })) as unknown as typeof fetch;

      try {
        const result = await fetchBcbSgs(189, '2023-01-01', '2023-01-31');
        expect(result.points).toEqual([]);
        expect(result.series_id).toBe(189);
        expect(result.series_label).toBe('IGP-M');
        expect(result.unit).toBe('%/month');
        expect(result.frequency).toBe('monthly');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('parses BCB response with comma-separated numbers and dd/mm/yyyy dates', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => [
          { data: '01/01/2023', valor: '0,61' },
          { data: '01/02/2023', valor: '-0,09' },
          { data: '01/03/2023', valor: '0,71' },
        ],
      })) as unknown as typeof fetch;

      try {
        const result = await fetchBcbSgs(189, '2023-01-01', '2023-03-31');
        expect(result.points).toHaveLength(3);
        expect(result.points[0]).toEqual({ date: '2023-01-01', value: 0.61 });
        expect(result.points[1]).toEqual({ date: '2023-02-01', value: -0.09 });
        expect(result.points[2]).toEqual({ date: '2023-03-01', value: 0.71 });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('skips non-finite values', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => [
          { data: '01/01/2023', valor: 'N/A' },
          { data: '01/02/2023', valor: '0,42' },
        ],
      })) as unknown as typeof fetch;

      try {
        const result = await fetchBcbSgs(189, '2023-01-01', '2023-02-28');
        expect(result.points).toHaveLength(1);
        expect(result.points[0].value).toBeCloseTo(0.42);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws when BCB returns non-200', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: false,
        status: 503,
      })) as unknown as typeof fetch;

      try {
        await expect(
          fetchBcbSgs(189, '2023-01-01', '2023-01-31')
        ).rejects.toThrow('HTTP 503');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('includes correct meta for IMA-B series', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async () => ({
        ok: true,
        json: async () => [{ data: '02/01/2023', valor: '5432,10' }],
      })) as unknown as typeof fetch;

      try {
        const result = await fetchBcbSgs(12466, '2023-01-01', '2023-01-31');
        expect(result.series_label).toBe('IMA-B');
        expect(result.unit).toBe('index');
        expect(result.frequency).toBe('daily');
        expect(result.points[0].value).toBeCloseTo(5432.1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
