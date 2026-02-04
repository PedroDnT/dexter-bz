import { describe, it, expect } from 'bun:test';
import AdmZip from 'adm-zip';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { extractCvmSegmentsFromZip, type CvmCompanyIdentifiers } from '../tools/finance/providers/cvm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = resolve(__dirname, 'fixtures', 'cvm');

function loadFixture(name: string): Buffer {
  return readFileSync(resolve(fixturesDir, name));
}

describe('CVM segmented revenues extraction', () => {
  it('extracts segment rows from CSVs with segment columns', () => {
    const zip = new AdmZip();
    zip.addFile('dfp_cia_aberta_SEG_con.csv', loadFixture('dfp_seg.csv'));

    const identifiers: CvmCompanyIdentifiers = { ticker: 'PETR4', cd_cvm: '12345' };
    const { segments } = extractCvmSegmentsFromZip(zip, identifiers, { year: 2023 });

    expect(segments.length).toBe(1);
    expect(segments[0].segment).toBe('Refino');
    expect(segments[0].value).toBe(500000);
  });
});

