import { describe, it, expect } from 'bun:test';
import AdmZip from 'adm-zip';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { extractCvmStatementsFromZip, type CvmCompanyIdentifiers } from '../tools/finance/providers/cvm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, 'fixtures', 'cvm');

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(fixturesDir, name));
}

describe('CVM statement extraction', () => {
  it('extracts statement rows from DFP zip and filters by year', () => {
    const zip = new AdmZip();
    zip.addFile('dfp_cia_aberta_DRE_con.csv', loadFixture('dfp_dre.csv'));
    zip.addFile('dfp_cia_aberta_BPA_con.csv', loadFixture('dfp_bpa.csv'));
    zip.addFile('dfp_cia_aberta_BPP_con.csv', loadFixture('dfp_bpp.csv'));
    zip.addFile('dfp_cia_aberta_DFC_con.csv', loadFixture('dfp_dfc.csv'));

    const identifiers: CvmCompanyIdentifiers = { ticker: 'PETR4', cd_cvm: '12345' };
    const { statements } = extractCvmStatementsFromZip(zip, identifiers, { year: 2023 });

    expect(statements.income_statement.length).toBeGreaterThan(0);
    expect(statements.balance_sheet.length).toBeGreaterThan(0);
    expect(statements.cash_flow.length).toBeGreaterThan(0);

    const years = new Set(statements.income_statement.map((row) => row.report_period?.slice(0, 4)));
    expect(years.has('2023')).toBe(true);
    expect(years.has('2022')).toBe(false);
  });

  it('filters by quarter when provided', () => {
    const zip = new AdmZip();
    zip.addFile('dfp_cia_aberta_DRE_con.csv', loadFixture('dfp_dre.csv'));

    const identifiers: CvmCompanyIdentifiers = { ticker: 'PETR4', cd_cvm: '12345' };
    const { statements } = extractCvmStatementsFromZip(zip, identifiers, { year: 2023, quarter: 1 });

    expect(statements.income_statement.length).toBeGreaterThan(0);
    expect(
      statements.income_statement.every((row) => row.report_period?.startsWith('2023-03'))
    ).toBe(true);
  });
});

