interface BrapiResponse {
  results?: unknown[];
  [key: string]: unknown;
}

export interface BrapiQuoteOptions {
  modules?: string[];
  fundamental?: boolean;
  dividends?: boolean;
  range?: string;
  interval?: string;
}

const BRAPI_BASE_URL = 'https://brapi.dev/api';

function requireBrapiToken(): string {
  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    throw new Error('BRAPI_TOKEN is required to fetch Brazil market data.');
  }
  return token;
}

export async function getBrapiQuote(
  symbols: string[],
  options: BrapiQuoteOptions = {}
): Promise<{ data: BrapiResponse; url: string }> {
  const token = requireBrapiToken();
  const symbolParam = symbols.join(',');
  const url = new URL(`${BRAPI_BASE_URL}/quote/${symbolParam}`);
  url.searchParams.set('token', token);

  if (options.modules && options.modules.length > 0) {
    url.searchParams.set('modules', options.modules.join(','));
  }
  if (options.fundamental) url.searchParams.set('fundamental', 'true');
  if (options.dividends) url.searchParams.set('dividends', 'true');
  if (options.range) url.searchParams.set('range', options.range);
  if (options.interval) url.searchParams.set('interval', options.interval);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`BRAPI request failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as BrapiResponse;
  return { data, url: url.toString() };
}
