/**
 * Fetch a URL and parse the response as JSON.
 * Throws an Error with the HTTP status if the response is not ok.
 *
 * @param url     - The URL to fetch
 * @param timeout - Optional timeout in milliseconds (uses AbortSignal.timeout)
 */
export async function fetchJson<T>(url: string | URL, timeout?: number): Promise<T> {
  const opts: RequestInit = timeout ? { signal: AbortSignal.timeout(timeout) } : {};
  const response = await fetch(url, opts);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
