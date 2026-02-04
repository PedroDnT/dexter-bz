import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import AdmZip from 'adm-zip';
import Papa from 'papaparse';
import iconv from 'iconv-lite';
import { normalizeTicker } from '../market.js';

const CVM_BASE_URL = 'https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC';
const CACHE_DIR = resolve(process.cwd(), '.dexter', 'cache', 'cvm');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const BRAZIL_DOC_TYPES = ['DFP', 'ITR', 'FRE', 'IPE'] as const;
export type BrazilDocType = (typeof BRAZIL_DOC_TYPES)[number];

export type CvmStatementType = 'income_statement' | 'balance_sheet' | 'cash_flow' | 'other';
export type CvmConsolidation = 'consolidated' | 'individual' | 'unknown';

export interface CvmStatementEntry {
  report_period?: string | null;
  statement_type: CvmStatementType;
  account_code?: string | null;
  account_name?: string | null;
  value?: number | null;
  consolidation?: CvmConsolidation;
  period_order?: string | null;
  currency?: string | null;
  source_file?: string | null;
}

export interface CvmStatements {
  income_statement: CvmStatementEntry[];
  balance_sheet: CvmStatementEntry[];
  cash_flow: CvmStatementEntry[];
  other?: CvmStatementEntry[];
}

export interface CvmFiling {
  accession_number?: string | null;
  filing_type: BrazilDocType;
  filing_date?: string | null;
  report_period?: string | null;
  document_url?: string | null;
  category?: string | null;
  company?: string | null;
}

export interface CvmCompanyIdentifiers {
  ticker: string;
  cd_cvm?: string;
  cnpj?: string;
  denom?: string;
}

const companyCache = new Map<string, CvmCompanyIdentifiers | null>();

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cachePath(docType: BrazilDocType, year: number): string {
  return join(CACHE_DIR, `${docType.toLowerCase()}_cia_aberta_${year}.zip`);
}

function buildZipUrl(docType: BrazilDocType, year: number): string {
  return `${CVM_BASE_URL}/${docType}/DADOS/${docType.toLowerCase()}_cia_aberta_${year}.zip`;
}

async function downloadZip(docType: BrazilDocType, year: number): Promise<{ path: string; url: string }> {
  ensureCacheDir();
  const path = cachePath(docType, year);
  const url = buildZipUrl(docType, year);

  if (existsSync(path)) {
    const mtime = statSync(path).mtime.getTime();
    if (Date.now() - mtime < CACHE_TTL_MS) {
      return { path, url };
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`CVM download failed: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(path, buffer);
  return { path, url };
}

function decodeCsv(buffer: Buffer): string {
  return iconv.decode(buffer, 'latin1');
}

function parseCsvRows(csvText: string): Array<Record<string, string>> {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
  });
  return Array.isArray(parsed.data) ? parsed.data : [];
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findColumn(keys: string[], patterns: string[]): string | null {
  const normalizedKeys = keys.map((k) => ({ raw: k, norm: normalizeKey(k) }));
  for (const pattern of patterns) {
    const normPattern = normalizeKey(pattern);
    const match = normalizedKeys.find((k) => k.norm === normPattern || k.norm.includes(normPattern));
    if (match) return match.raw;
  }
  return null;
}

function extractField(row: Record<string, string>, patterns: string[]): string | null {
  const keys = Object.keys(row);
  const column = findColumn(keys, patterns);
  if (!column) return null;
  const value = row[column];
  return value ?? null;
}

function matchesCompany(row: Record<string, string>, identifiers: CvmCompanyIdentifiers): boolean {
  const keys = Object.keys(row);
  const cdCvmKey = findColumn(keys, ['CD_CVM', 'COD_CVM', 'CVM']);
  if (identifiers.cd_cvm && cdCvmKey && row[cdCvmKey] === identifiers.cd_cvm) return true;

  const cnpjKey = findColumn(keys, ['CNPJ_CIA', 'CNPJ']);
  if (identifiers.cnpj && cnpjKey) {
    const clean = (value: string) => value.replace(/\D/g, '');
    if (clean(row[cnpjKey] || '') === clean(identifiers.cnpj)) return true;
  }

  const denomKey = findColumn(keys, ['DENOM_CIA', 'DENOM', 'NOME_CIA', 'NOME']);
  if (identifiers.denom && denomKey) {
    const denom = (row[denomKey] || '').toLowerCase();
    if (denom && identifiers.denom.toLowerCase().includes(denom)) return true;
  }

  const tickerKey = findColumn(keys, ['CD_NEGOCIACAO', 'COD_NEGOCIACAO', 'COD_NEGOC', 'NEGOCIACAO']);
  if (tickerKey) {
    const tickerValue = (row[tickerKey] || '').toUpperCase();
    if (tickerValue.includes(identifiers.ticker)) return true;
  }

  return false;
}

function parseBrazilNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return trimmed;
}

function parseReportPeriod(row: Record<string, string>): string | null {
  const raw = extractField(row, [
    'DT_REFER',
    'DT_REF',
    'DT_FIM_EXERC',
    'DT_FIM_EXERCICIO',
    'DT_FIM_EXERC_SOCIAL',
  ]);
  return normalizeDate(raw);
}

function matchesYearQuarter(reportPeriod: string | null, year?: number, quarter?: number): boolean {
  if (!year && !quarter) return true;
  if (!reportPeriod) return false;
  const date = new Date(reportPeriod);
  if (Number.isNaN(date.getTime())) return false;
  if (year && date.getFullYear() !== year) return false;
  if (quarter) {
    const q = Math.ceil((date.getMonth() + 1) / 3);
    if (q !== quarter) return false;
  }
  return true;
}

function detectStatementType(entryName: string): { type: CvmStatementType; consolidation: CvmConsolidation } | null {
  const name = entryName.toLowerCase();
  const consolidation: CvmConsolidation = name.includes('_con')
    ? 'consolidated'
    : name.includes('_ind')
      ? 'individual'
      : 'unknown';

  if (name.includes('dre')) return { type: 'income_statement', consolidation };
  if (name.includes('bpa') || name.includes('bpp')) return { type: 'balance_sheet', consolidation };
  if (name.includes('dfc')) return { type: 'cash_flow', consolidation };
  if (name.includes('dva')) return { type: 'other', consolidation };
  return null;
}

export function extractCvmStatementsFromZip(
  zip: AdmZip,
  identifiers: CvmCompanyIdentifiers,
  options: { year?: number; quarter?: number } = {}
): { statements: CvmStatements; sourceFiles: string[] } {
  const statements: CvmStatements = {
    income_statement: [],
    balance_sheet: [],
    cash_flow: [],
    other: [],
  };
  const sourceFiles: string[] = [];

  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.csv'));
  for (const entry of entries) {
    const statementInfo = detectStatementType(entry.entryName);
    if (!statementInfo) continue;

    const csvText = decodeCsv(entry.getData());
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) continue;

    const keys = Object.keys(rows[0]);
    const accountCodeKey = findColumn(keys, ['CD_CONTA', 'COD_CONTA', 'CD_CONTA_PADRAO']);
    const accountNameKey = findColumn(keys, ['DS_CONTA', 'DESC_CONTA', 'DS_CONTA_PADRAO']);
    const valueKey = findColumn(keys, ['VL_CONTA', 'VL_CONTA_MOV', 'VALOR', 'VL_CONTA_PADRAO']);
    const currencyKey = findColumn(keys, ['MOEDA', 'CD_MOEDA']);
    const orderKey = findColumn(keys, ['ORDEM_EXERC', 'ORDEM_EXERCICIO']);

    if (!valueKey || !accountNameKey) continue;

    sourceFiles.push(entry.entryName);

    for (const row of rows) {
      if (!matchesCompany(row, identifiers)) continue;
      const reportPeriod = parseReportPeriod(row);
      if (!matchesYearQuarter(reportPeriod, options.year, options.quarter)) continue;

      const entryValue: CvmStatementEntry = {
        report_period: reportPeriod,
        statement_type: statementInfo.type,
        account_code: accountCodeKey ? row[accountCodeKey] ?? null : null,
        account_name: accountNameKey ? row[accountNameKey] ?? null : null,
        value: parseBrazilNumber(row[valueKey]),
        consolidation: statementInfo.consolidation,
        period_order: orderKey ? row[orderKey] ?? null : null,
        currency: currencyKey ? row[currencyKey] ?? null : null,
        source_file: entry.entryName,
      };

      if (statementInfo.type === 'income_statement') {
        statements.income_statement.push(entryValue);
      } else if (statementInfo.type === 'balance_sheet') {
        statements.balance_sheet.push(entryValue);
      } else if (statementInfo.type === 'cash_flow') {
        statements.cash_flow.push(entryValue);
      } else {
        statements.other?.push(entryValue);
      }
    }
  }

  return { statements, sourceFiles };
}

async function resolveCompanyIdentifiers(ticker: string): Promise<CvmCompanyIdentifiers | null> {
  const normalized = normalizeTicker(ticker);
  if (companyCache.has(normalized.canonical)) {
    return companyCache.get(normalized.canonical) || null;
  }

  const year = new Date().getFullYear();
  const docTypes: BrazilDocType[] = ['ITR', 'DFP'];

  for (const docType of docTypes) {
    try {
      const { path } = await downloadZip(docType, year);
      const zip = new AdmZip(path);
      const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.csv'));
      const candidates = entries.filter((e) =>
        /capital|compos|negociac/i.test(e.entryName)
      );
      const searchEntries = candidates.length > 0 ? candidates : entries;

      for (const entry of searchEntries) {
        const csvText = decodeCsv(entry.getData());
        const rows = parseCsvRows(csvText);
        if (rows.length === 0) continue;
        const keys = Object.keys(rows[0]);
        const tickerKey = findColumn(keys, [
          'CD_NEGOCIACAO',
          'COD_NEGOCIACAO',
          'COD_NEGOC',
          'NEGOCIACAO',
        ]);
        if (!tickerKey) continue;

        for (const row of rows) {
          const value = (row[tickerKey] || '').toUpperCase();
          if (!value || !value.includes(normalized.canonical)) continue;
          const cd_cvm = extractField(row, ['CD_CVM', 'COD_CVM', 'CVM']) ?? undefined;
          const cnpj = extractField(row, ['CNPJ_CIA', 'CNPJ']) ?? undefined;
          const denom = extractField(row, ['DENOM_CIA', 'DENOM', 'NOME_CIA', 'NOME']) ?? undefined;
          const identifiers: CvmCompanyIdentifiers = {
            ticker: normalized.canonical,
            cd_cvm,
            cnpj,
            denom,
          };
          companyCache.set(normalized.canonical, identifiers);
          return identifiers;
        }
      }
    } catch {
      continue;
    }
  }

  companyCache.set(normalized.canonical, null);
  return null;
}

async function extractFilingsFromZip(
  docType: BrazilDocType,
  year: number,
  identifiers: CompanyIdentifiers
): Promise<CvmFiling[]> {
  const { path } = await downloadZip(docType, year);
  const zip = new AdmZip(path);
  const entries = zip.getEntries().filter((e) => e.entryName.toLowerCase().endsWith('.csv'));
  const filings: CvmFiling[] = [];

  for (const entry of entries) {
    const csvText = decodeCsv(entry.getData());
    const rows = parseCsvRows(csvText);
    if (rows.length === 0) continue;
    const keys = Object.keys(rows[0]);
    const linkKey = findColumn(keys, ['LINK_DOC', 'LINK_DOCUM', 'LINK_ARQ', 'LINK_ARQUIVO', 'LINK']);
    if (!linkKey) continue;

    for (const row of rows) {
      if (!matchesCompany(row, identifiers)) continue;
      const filingDate = extractField(row, ['DT_RECEB', 'DT_ENTREGA', 'DT_RECEBIMENTO', 'DT_PROTOCOLO', 'DT_DOC']);
      const reportPeriod = extractField(row, ['DT_REFER', 'DT_REF', 'DT_FIM_EXERC', 'DT_FIM_EXERCICIO']);
      const accession = extractField(row, ['NUM_PROTOCOLO', 'NUM_PROT', 'ID_DOC', 'CD_DOC', 'PROTOCOLO']);
      const category = extractField(row, ['ASSUNTO', 'CATEGORIA', 'GRUPO', 'EVENTO']);
      const company = extractField(row, ['DENOM_CIA', 'DENOM', 'NOME_CIA', 'NOME']);

      filings.push({
        accession_number: accession,
        filing_type: docType,
        filing_date: filingDate,
        report_period: reportPeriod,
        document_url: row[linkKey] || null,
        category,
        company,
      });
    }
  }

  return filings;
}

function sortFilings(filings: CvmFiling[]): CvmFiling[] {
  return filings.sort((a, b) => {
    const da = new Date(a.filing_date || a.report_period || 0).getTime();
    const db = new Date(b.filing_date || b.report_period || 0).getTime();
    return db - da;
  });
}

export async function getCvmFilings(params: {
  ticker: string;
  filingTypes?: BrazilDocType[];
  limit?: number;
}): Promise<{ filings: CvmFiling[]; sourceUrls: string[] }> {
  const identifiers = await resolveCompanyIdentifiers(params.ticker);
  if (!identifiers) {
    return { filings: [], sourceUrls: [] };
  }

  const year = new Date().getFullYear();
  const types = params.filingTypes && params.filingTypes.length > 0 ? params.filingTypes : [...BRAZIL_DOC_TYPES];
  const filings: CvmFiling[] = [];
  const sourceUrls: string[] = [];

  for (const type of types) {
    for (const targetYear of [year, year - 1]) {
      try {
        const url = buildZipUrl(type, targetYear);
        const data = await extractFilingsFromZip(type, targetYear, identifiers);
        if (data.length > 0) {
          filings.push(...data);
          sourceUrls.push(url);
        }
      } catch {
        continue;
      }
    }
  }

  const sorted = sortFilings(filings);
  const limit = params.limit ?? 10;
  return { filings: sorted.slice(0, limit), sourceUrls };
}

export async function getCvmStatements(params: {
  ticker: string;
  filingType: BrazilDocType;
  year?: number;
  quarter?: number;
}): Promise<{ statements: CvmStatements; sourceUrls: string[]; note?: string }> {
  if (params.filingType !== 'DFP' && params.filingType !== 'ITR') {
    return {
      statements: { income_statement: [], balance_sheet: [], cash_flow: [] },
      sourceUrls: [],
      note: 'Statements are only available for DFP (annual) and ITR (quarterly).',
    };
  }

  const identifiers = await resolveCompanyIdentifiers(params.ticker);
  if (!identifiers) {
    return {
      statements: { income_statement: [], balance_sheet: [], cash_flow: [] },
      sourceUrls: [],
      note: 'Unable to resolve company identifiers for CVM statement extraction.',
    };
  }

  const year = params.year ?? new Date().getFullYear();
  const { path, url } = await downloadZip(params.filingType, year);
  const zip = new AdmZip(path);
  const { statements } = extractCvmStatementsFromZip(zip, identifiers, { year, quarter: params.quarter });

  const hasData =
    statements.income_statement.length > 0 ||
    statements.balance_sheet.length > 0 ||
    statements.cash_flow.length > 0 ||
    (statements.other?.length ?? 0) > 0;

  return {
    statements,
    sourceUrls: [url],
    note: hasData ? undefined : 'No statement rows found in CVM datasets for the requested period.',
  };
}

export async function getCvmFilingItems(params: {
  ticker: string;
  filingType: BrazilDocType;
  year?: number;
  quarter?: number;
  accession_number?: string;
}): Promise<{ data: Record<string, unknown>; sourceUrls: string[] }> {
  const { filings, sourceUrls } = await getCvmFilings({
    ticker: params.ticker,
    filingTypes: [params.filingType],
    limit: 50,
  });

  const year = params.year;
  const quarter = params.quarter;

  const filtered = filings.filter((filing) => {
    if (params.accession_number && filing.accession_number) {
      return filing.accession_number === params.accession_number;
    }
    if (year) {
      const dateStr = filing.report_period || filing.filing_date;
      if (!dateStr) return false;
      if (!String(dateStr).startsWith(String(year))) return false;
    }
    if (quarter) {
      const dateStr = filing.report_period || filing.filing_date;
      if (!dateStr) return false;
      const month = new Date(dateStr).getMonth() + 1;
      const q = Math.ceil(month / 3);
      if (q !== quarter) return false;
    }
    return true;
  });

  let statementsResult: { statements: CvmStatements; sourceUrls: string[]; note?: string } | null = null;
  if (params.filingType === 'DFP' || params.filingType === 'ITR') {
    statementsResult = await getCvmStatements({
      ticker: params.ticker,
      filingType: params.filingType,
      year,
      quarter,
    });
  }

  const notes: string[] = ['CVM filings do not use SEC item structure. Returning document links and metadata.'];
  if (params.filingType === 'IPE') {
    notes.push('IPE is an event disclosure; statement tables are not available.');
  }
  if (statementsResult?.note) notes.push(statementsResult.note);

  const mergedUrls = [...sourceUrls, ...(statementsResult?.sourceUrls ?? [])];

  return {
    data: {
      note: notes.join(' '),
      filing_type: params.filingType,
      documents: filtered,
      statements: statementsResult?.statements,
    },
    sourceUrls: mergedUrls,
  };
}
