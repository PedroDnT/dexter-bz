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

export async function getLatestPtax(): Promise<PtaxRate> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
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

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`PTAX request failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as PtaxResponse;
    const items = Array.isArray(json.value) ? json.value : [];
    const selected = selectLatestPtax(items);
    const value: PtaxRate = {
      ...selected,
      sourceUrl: url,
    };

    cached = { value, expiresAt: Date.now() + SIX_HOURS_MS };
    return value;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
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
