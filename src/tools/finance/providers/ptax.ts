export interface PtaxRate {
  usd_brl: number;
  timestamp: string;
  sourceUrl: string;
}

interface PtaxResponseItem {
  cotacaoCompra?: number;
  cotacaoVenda?: number;
  dataHoraCotacao?: string;
  tipoBoletim?: string;
}

interface PtaxResponse {
  value?: PtaxResponseItem[];
}

let cached: { value: PtaxRate; expiresAt: number } | null = null;
let inFlight: Promise<PtaxRate> | null = null;

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function formatDateMmDdYyyy(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
}

export function selectLatestPtax(items: PtaxResponseItem[]): PtaxRate {
  const withType = items.filter((i) => i.tipoBoletim === 'Fechamento' && i.cotacaoVenda);
  const candidates = withType.length > 0 ? withType : items.filter((i) => i.cotacaoVenda);
  if (candidates.length === 0) {
    throw new Error('PTAX: no valid cotacaoVenda found');
  }

  const latest = candidates
    .filter((i) => i.dataHoraCotacao)
    .sort((a, b) => {
      const da = new Date(a.dataHoraCotacao as string).getTime();
      const db = new Date(b.dataHoraCotacao as string).getTime();
      return db - da;
    })[0];

  if (!latest || !latest.cotacaoVenda || !latest.dataHoraCotacao) {
    throw new Error('PTAX: could not select latest rate');
  }

  return {
    usd_brl: latest.cotacaoVenda,
    timestamp: latest.dataHoraCotacao,
    sourceUrl: '',
  };
}

async function fetchFromBcb(): Promise<PtaxRate> {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 10);

  const dataInicial = formatDateMmDdYyyy(start);
  const dataFinal = formatDateMmDdYyyy(end);

  const baseUrl =
    'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo';
  const url =
    `${baseUrl}(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
    `?@dataInicial='${dataInicial}'&@dataFinalCotacao='${dataFinal}'&$top=100&$format=json`;

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`BCB PTAX API returned ${response.status}`);
  }
  const json = (await response.json()) as PtaxResponse;
  const items = Array.isArray(json.value) ? json.value : [];
  const selected = selectLatestPtax(items);
  return {
    ...selected,
    sourceUrl: url,
  };
}

async function fetchFromAwesomeApi(): Promise<PtaxRate> {
  const url = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`AwesomeAPI returned ${response.status}`);
  }
  const json = await response.json() as { USDBRL?: { bid?: string; ask?: string; create_date?: string } };
  const data = json.USDBRL;
  if (!data?.ask) {
    throw new Error('AwesomeAPI: missing ask price');
  }
  return {
    usd_brl: parseFloat(data.ask),
    timestamp: data.create_date || new Date().toISOString(),
    sourceUrl: url,
  };
}

async function fetchFromExchangeRateApi(): Promise<PtaxRate> {
  const url = 'https://api.exchangerate-api.com/v4/latest/USD';
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`ExchangeRate-API returned ${response.status}`);
  }
  const json = await response.json() as { rates?: { BRL?: number }; date?: string };
  const rate = json.rates?.BRL;
  if (!rate) {
    throw new Error('ExchangeRate-API: missing BRL rate');
  }
  return {
    usd_brl: rate,
    timestamp: json.date || new Date().toISOString(),
    sourceUrl: url,
  };
}

async function getLatestPtax(): Promise<PtaxRate> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const sources = [
      { name: 'BCB', fn: fetchFromBcb },
      { name: 'AwesomeAPI', fn: fetchFromAwesomeApi },
      { name: 'ExchangeRate-API', fn: fetchFromExchangeRateApi },
    ];

    const errors: string[] = [];
    for (const source of sources) {
      try {
        const value = await source.fn();
        cached = { value, expiresAt: Date.now() + SIX_HOURS_MS };
        return value;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${source.name}: ${msg}`);
      }
    }

    throw new Error(`All PTAX sources failed: ${errors.join('; ')}`);
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function getLatestPtaxSafe(): Promise<PtaxRate | null> {
  try {
    return await getLatestPtax();
  } catch {
    return null;
  }
}

export function convertBrlToUsd(value: number, usdBrl: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(usdBrl) || usdBrl === 0) return value;
  return value / usdBrl;
}

export function addUsdFields<T extends Record<string, unknown>>(
  record: T,
  fields: string[],
  usdBrl: number
): T & Record<string, unknown> {
  const next: Record<string, unknown> = { ...record };
  for (const field of fields) {
    const raw = record[field];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      next[`${field}_usd`] = convertBrlToUsd(raw, usdBrl);
    }
  }
  return next as T & Record<string, unknown>;
}
