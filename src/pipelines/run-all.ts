#!/usr/bin/env bun
import 'dotenv/config';
import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { runFraudInvestigation } from './fraud/index.js';
import { renderFraudReportHtml } from './fraud/report.js';
import type { InvestigationTargetInput } from './fraud/types.js';

type ParsedArgs = {
  targets: string[];
  configPath?: string;
  outDir?: string;
  open: boolean;
  noSetup: boolean;
  noNotebooks: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    targets: [],
    open: false,
    noSetup: false,
    noNotebooks: false,
  };

  const tokens = [...argv];
  while (tokens.length) {
    const token = tokens.shift() as string;
    if (token === '--target') {
      const value = tokens.shift();
      if (value) args.targets.push(value);
      continue;
    }
    if (token === '--targets') {
      const value = tokens.shift();
      if (value) {
        value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => args.targets.push(t));
      }
      continue;
    }
    if (token === '--config') {
      const value = tokens.shift();
      if (value) args.configPath = value;
      continue;
    }
    if (token === '--out') {
      const value = tokens.shift();
      if (value) args.outDir = value;
      continue;
    }
    if (token === '--open') {
      args.open = true;
      continue;
    }
    if (token === '--no-setup') {
      args.noSetup = true;
      continue;
    }
    if (token === '--no-notebooks') {
      args.noNotebooks = true;
      continue;
    }
  }

  return args;
}

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, 60);
  return base || 'target';
}

function formatRunId(): string {
  const iso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
  const rand = Math.random().toString(16).slice(2, 8);
  return `${iso}-${rand}`;
}

function loadTargetsFromConfig(configPath: string): InvestigationTargetInput[] {
  const content = readFileSync(configPath, 'utf-8');
  const json = JSON.parse(content) as unknown;

  const normalize = (value: unknown): InvestigationTargetInput | null => {
    if (typeof value === 'string' && value.trim()) return { query: value.trim() };
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const query = typeof record.query === 'string' ? record.query.trim() : '';
      const label = typeof record.label === 'string' ? record.label.trim() : undefined;
      if (query) return { query, label };
    }
    return null;
  };

  if (Array.isArray(json)) {
    return json.map(normalize).filter((t): t is InvestigationTargetInput => Boolean(t));
  }
  if (json && typeof json === 'object') {
    const targets = (json as { targets?: unknown }).targets;
    if (Array.isArray(targets)) {
      return targets.map(normalize).filter((t): t is InvestigationTargetInput => Boolean(t));
    }
  }

  throw new Error(`Unsupported config shape in ${configPath}`);
}

function getVenvPython(venvDir: string): string {
  if (process.platform === 'win32') {
    return path.join(venvDir, 'Scripts', 'python.exe');
  }
  return path.join(venvDir, 'bin', 'python');
}

function runCommand(
  cmd: string,
  cmdArgs: string[],
  options?: { env?: Record<string, string | undefined> }
): { ok: boolean; stdout: string; stderr: string } {
  const proc = spawnSync(cmd, cmdArgs, {
    env: { ...process.env, ...(options?.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
  return {
    ok: proc.status === 0,
    stdout: proc.stdout || '',
    stderr: proc.stderr || '',
  };
}

function canImportYfinance(pythonBin: string): boolean {
  const check = runCommand(pythonBin, ['-c', 'import yfinance, pandas, requests; print("ok")']);
  return check.ok;
}

function ensureYfinanceReady(): { ok: boolean; pythonBin?: string; note?: string } {
  const explicit = process.env.YFINANCE_PYTHON_BIN;
  if (explicit && canImportYfinance(explicit)) {
    return { ok: true, pythonBin: explicit, note: `Using YFINANCE_PYTHON_BIN=${explicit}` };
  }

  const outRoot = '.dexter';
  const venvDir = path.join(outRoot, 'venv-yfinance');
  const venvPython = getVenvPython(venvDir);

  if (!existsSync(outRoot)) mkdirSync(outRoot, { recursive: true });

  if (!existsSync(venvPython)) {
    const baseCandidates = [explicit, 'python3', 'python', 'py'].filter(Boolean) as string[];
    const basePython = baseCandidates.find((candidate) =>
      runCommand(candidate, ['-c', 'import sys; print(sys.executable)']).ok
    );
    if (!basePython) {
      return { ok: false, note: 'No Python executable found (tried python3, python, py)' };
    }

    const created = runCommand(basePython, ['-m', 'venv', venvDir]);
    if (!created.ok) {
      return { ok: false, note: `Failed to create venv: ${created.stderr || created.stdout}` };
    }
  }

  if (!canImportYfinance(venvPython)) {
    const installed = runCommand(venvPython, ['-m', 'pip', 'install', '-r', 'scripts/yfinance/requirements.txt']);
    if (!installed.ok) {
      return {
        ok: false,
        pythonBin: venvPython,
        note: `Failed to install yfinance requirements: ${installed.stderr || installed.stdout}`,
      };
    }
  }

  process.env.YFINANCE_PYTHON_BIN = venvPython;
  return { ok: true, pythonBin: venvPython, note: `Using venv python: ${venvPython}` };
}

function tryRunNotebooks(
  notebooksDir: string,
  outputDir: string
): { outputs: Array<{ notebook: string; htmlPath: string }>; errors: string[] } {
  const outputs: Array<{ notebook: string; htmlPath: string }> = [];
  const errors: string[] = [];

  if (!existsSync(notebooksDir)) return { outputs, errors };

  const entries = readdirSync(notebooksDir, { withFileTypes: true });
  const notebooks = entries
    .filter((e) => e.isFile() && e.name.endsWith('.ipynb'))
    .map((e) => path.join(notebooksDir, e.name));

  if (notebooks.length === 0) return { outputs, errors };

  const notebooksOut = path.join(outputDir, 'notebooks');
  mkdirSync(notebooksOut, { recursive: true });

  const pythonBin = process.env.YFINANCE_PYTHON_BIN || 'python3';
  for (const nb of notebooks) {
    const htmlName = `${path.basename(nb, '.ipynb')}.html`;
    const run = runCommand(pythonBin, [
      '-m',
      'jupyter',
      'nbconvert',
      '--to',
      'html',
      '--execute',
      '--output',
      htmlName,
      '--output-dir',
      notebooksOut,
      nb,
    ]);
    if (!run.ok) {
      errors.push(`Notebook failed (${path.basename(nb)}): ${run.stderr || run.stdout}`);
      continue;
    }
    outputs.push({ notebook: nb, htmlPath: path.join('notebooks', htmlName) });
  }

  return { outputs, errors };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderIndexHtml(params: {
  runId: string;
  generatedAt: string;
  items: Array<{ label: string; ticker: string; market: string; href: string; severity: string; flags: number; errors: number }>;
  notebookLinks: Array<{ notebook: string; htmlPath: string }>;
  notebookErrors: string[];
}): string {
  const rows = params.items
    .map((item) => {
      const cls = item.severity.toLowerCase();
      return `<tr>
        <td><a href="${item.href}">${escapeHtml(item.label)}</a><div class="muted">${escapeHtml(item.ticker)} · ${escapeHtml(item.market)}</div></td>
        <td><span class="badge badge-${cls}">${escapeHtml(item.severity)}</span></td>
        <td>${item.flags}</td>
        <td>${item.errors}</td>
      </tr>`;
    })
    .join('\n');

  const notebooks = params.notebookLinks.length
    ? `<ul>${params.notebookLinks
        .map((n) => `<li><a href="${n.htmlPath}">${escapeHtml(path.basename(n.notebook))}</a></li>`)
        .join('\n')}</ul>`
    : '<p class="muted">No notebooks executed.</p>';

  const nbErrors = params.notebookErrors.length
    ? `<pre class="errors">${escapeHtml(JSON.stringify(params.notebookErrors, null, 2))}</pre>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dexter — Investigation Run — ${escapeHtml(params.runId)}</title>
    <style>
      :root {
        --bg: #0b1020;
        --card: #121a33;
        --text: #e7ebff;
        --muted: #a7b0d9;
        --border: rgba(255,255,255,0.08);
        --high: #ff5c7a;
        --medium: #ffb020;
        --low: #5ecb8a;
        --none: #7f8bbd;
      }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background: var(--bg); color: var(--text); }
      a { color: #b5c7ff; }
      .container { max-width: 1040px; margin: 0 auto; padding: 28px 18px 60px; }
      .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 14px; margin-top: 14px; }
      .title { font-size: 20px; font-weight: 800; }
      .muted { color: var(--muted); font-size: 13px; margin-top: 6px; }
      table { width:100%; border-collapse: collapse; margin-top: 10px; }
      th, td { text-align: left; padding: 10px 8px; border-top: 1px solid var(--border); vertical-align: top; }
      th { color: var(--muted); font-size: 12px; font-weight: 700; }
      .badge { display:inline-block; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.3px; }
      .badge-high { background: rgba(255,92,122,0.16); border: 1px solid rgba(255,92,122,0.35); color: #ffd1da; }
      .badge-medium { background: rgba(255,176,32,0.14); border: 1px solid rgba(255,176,32,0.35); color: #ffe1ad; }
      .badge-low { background: rgba(94,203,138,0.14); border: 1px solid rgba(94,203,138,0.30); color: #d2ffe5; }
      .badge-none { background: rgba(127,139,189,0.16); border: 1px solid rgba(127,139,189,0.35); color: #d7ddff; }
      pre.errors { background: rgba(0,0,0,0.18); border: 1px solid var(--border); border-radius: 12px; padding: 10px; overflow: auto; color: #e7ebff; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="title">Investigation run</div>
      <div class="muted">Run ID: ${escapeHtml(params.runId)} · Generated: ${escapeHtml(params.generatedAt)}</div>

      <div class="card">
        <h2>Targets</h2>
        <table>
          <thead>
            <tr><th>Target</th><th>Severity</th><th>Flags</th><th>Errors</th></tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" class="muted">No targets.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>Notebooks</h2>
        ${notebooks}
        ${nbErrors}
      </div>
    </div>
  </body>
</html>`;
}

function severityForFlags(flags: Array<{ severity: string }>): string {
  const rank = (s: string) => (s === 'high' ? 3 : s === 'medium' ? 2 : s === 'low' ? 1 : 0);
  const best = flags.reduce((acc, f) => (rank(f.severity) > rank(acc) ? f.severity : acc), 'none');
  return best.toUpperCase();
}

function openFile(filepath: string): void {
  const full = path.resolve(filepath);
  if (process.platform === 'darwin') {
    spawnSync('open', [full], { stdio: 'ignore' });
    return;
  }
  if (process.platform === 'linux') {
    spawnSync('xdg-open', [full], { stdio: 'ignore' });
    return;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const defaultConfig = 'investigations/targets.json';
  const configPath = args.configPath || (existsSync(defaultConfig) ? defaultConfig : undefined);

  const targets: InvestigationTargetInput[] =
    args.targets.length > 0
      ? args.targets.map((q) => ({ query: q }))
      : configPath
        ? loadTargetsFromConfig(configPath)
        : [{ query: 'AAPL' }];

  const outDir = args.outDir || path.join('.dexter', 'reports');
  const runId = formatRunId();
  const runDir = path.join(outDir, runId);
  mkdirSync(runDir, { recursive: true });

  if (!args.noSetup) {
    const setup = ensureYfinanceReady();
    if (!setup.ok) {
      console.warn(`[setup] yfinance not ready: ${setup.note || 'unknown error'}`);
      console.warn('[setup] Brazil tickers and name-based search may fail. To fix:');
      console.warn('  - Install Python deps: python3 -m pip install -r scripts/yfinance/requirements.txt');
    } else if (setup.note) {
      console.log(`[setup] ${setup.note}`);
    }
  }

  const usedSlugs = new Map<string, number>();
  const indexItems: Array<{ label: string; ticker: string; market: string; href: string; severity: string; flags: number; errors: number }> = [];

  for (const target of targets) {
    const label = target.label || target.query;
    const baseSlug = slugify(label);
    const n = usedSlugs.get(baseSlug) ?? 0;
    usedSlugs.set(baseSlug, n + 1);
    const slug = n === 0 ? baseSlug : `${baseSlug}-${n + 1}`;

    const targetDir = path.join(runDir, slug);
    mkdirSync(targetDir, { recursive: true });

    console.log(`[run] ${label}`);
    const result = await runFraudInvestigation(target, {});

    const jsonPath = path.join(targetDir, 'data.json');
    writeFileSync(jsonPath, JSON.stringify(result, null, 2));

    const html = renderFraudReportHtml(result);
    const htmlPath = path.join(targetDir, 'report.html');
    writeFileSync(htmlPath, html);

    const severity = severityForFlags(result.flags);
    indexItems.push({
      label: result.target.label,
      ticker: result.target.ticker,
      market: result.target.market,
      href: `${slug}/report.html`,
      severity,
      flags: result.flags.length,
      errors: result.errors.length,
    });
  }

  const notebooksDir = 'notebooks';
  const notebookResults = args.noNotebooks ? { outputs: [], errors: [] } : tryRunNotebooks(notebooksDir, runDir);

  const indexHtml = renderIndexHtml({
    runId,
    generatedAt: new Date().toISOString(),
    items: indexItems,
    notebookLinks: notebookResults.outputs,
    notebookErrors: notebookResults.errors,
  });
  const indexPath = path.join(runDir, 'index.html');
  writeFileSync(indexPath, indexHtml);

  const latestDir = path.join(outDir, 'latest');
  mkdirSync(latestDir, { recursive: true });
  const latestIndex = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=../${encodeURIComponent(runId)}/index.html"><title>Dexter — Latest</title><p><a href="../${escapeHtml(runId)}/index.html">Open latest run</a></p>`;
  writeFileSync(path.join(latestDir, 'index.html'), latestIndex);

  console.log('');
  console.log(`Report index: ${path.resolve(indexPath)}`);
  console.log(`Latest: ${path.resolve(latestDir, 'index.html')}`);

  if (args.open) {
    openFile(path.join(latestDir, 'index.html'));
  }
}

await main();

