import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCRIPT_PATH = resolve(__dirname, '../../../../scripts/yfinance/yfinance_bridge.py');

interface YFinanceResponse {
  ok: boolean;
  data?: unknown;
  error?: string;
  source?: string;
}

function runPython(
  pythonBin: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<YFinanceResponse> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(pythonBin, [SCRIPT_PATH], { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectPromise(new Error('yfinance bridge timeout'));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      rejectPromise(err);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout) {
        rejectPromise(new Error(stderr || `yfinance bridge exited with code ${code}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as YFinanceResponse;
        resolvePromise(parsed);
      } catch (err) {
        rejectPromise(new Error(`yfinance bridge invalid JSON: ${String(err)}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function callYfinance(payload: Record<string, unknown>, timeoutMs = 20000): Promise<unknown> {
  const primary = process.env.YFINANCE_PYTHON_BIN || 'python3';
  try {
    const response = await runPython(primary, payload, timeoutMs);
    if (!response.ok) {
      throw new Error(response.error || 'yfinance bridge error');
    }
    return response.data;
  } catch (error) {
    if (primary !== 'python') {
      const fallback = await runPython('python', payload, timeoutMs);
      if (!fallback.ok) {
        throw new Error(fallback.error || 'yfinance bridge error');
      }
      return fallback.data;
    }
    throw error;
  }
}

export async function yfinanceHistory(params: {
  symbol: string;
  start_date: string;
  end_date: string;
  interval: string;
}): Promise<unknown> {
  return callYfinance({ action: 'history', ...params });
}

export async function yfinanceNews(symbol: string): Promise<unknown> {
  return callYfinance({ action: 'news', symbol });
}

export async function yfinanceEstimates(symbol: string): Promise<unknown> {
  return callYfinance({ action: 'estimates', symbol });
}

export async function yfinanceInfo(symbol: string): Promise<unknown> {
  return callYfinance({ action: 'info', symbol });
}

export async function yfinanceStatements(params: {
  symbol: string;
  statement_type: 'income' | 'balance' | 'cashflow';
}): Promise<unknown> {
  return callYfinance({ action: 'statements', ...params });
}

export async function yfinanceSearch(query: string): Promise<unknown> {
  return callYfinance({ action: 'search', query });
}
