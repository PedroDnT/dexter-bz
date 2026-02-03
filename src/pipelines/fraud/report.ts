import type { FraudFlag, FraudInvestigationResult, FlagSeverity } from './types.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function severityRank(sev: FlagSeverity): number {
  if (sev === 'high') return 3;
  if (sev === 'medium') return 2;
  return 1;
}

function summarizeSeverity(flags: FraudFlag[]): { level: FlagSeverity | 'none'; count: number } {
  if (flags.length === 0) return { level: 'none', count: 0 };
  const sorted = [...flags].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  return { level: sorted[0].severity, count: flags.length };
}

function formatPercent(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function formatNumber(value: unknown): string {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return escapeHtml(value);
  const abs = Math.abs(n);
  const digits = abs >= 1e9 ? 2 : abs >= 1e6 ? 2 : abs >= 1e3 ? 2 : 2;
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function renderKeyValueTable(title: string, rows: Array<[string, unknown]>): string {
  const items = rows
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`)
    .join('\n');
  if (!items) return '';
  return `
  <section class="card">
    <h2>${escapeHtml(title)}</h2>
    <table class="kv">
      <tbody>
        ${items}
      </tbody>
    </table>
  </section>
  `;
}

function renderFlags(flags: FraudFlag[]): string {
  if (flags.length === 0) {
    return `
    <section class="card">
      <h2>Flags</h2>
      <p class="muted">No heuristic flags triggered for the available data.</p>
    </section>
    `;
  }

  const rows = [...flags]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .map((flag) => {
      const evidence = flag.evidence
        ? `<pre class="evidence">${escapeHtml(JSON.stringify(flag.evidence, null, 2))}</pre>`
        : '';
      return `
      <div class="flag">
        <div class="flag-head">
          <span class="badge badge-${escapeHtml(flag.severity)}">${escapeHtml(flag.severity.toUpperCase())}</span>
          <span class="flag-title">${escapeHtml(flag.title)}</span>
        </div>
        <div class="flag-detail">${escapeHtml(flag.detail)}</div>
        ${evidence}
      </div>`;
    })
    .join('\n');

  return `
  <section class="card">
    <h2>Flags</h2>
    ${rows}
  </section>
  `;
}

export function renderFraudReportHtml(result: FraudInvestigationResult): string {
  const { level, count } = summarizeSeverity(result.flags);
  const currency = result.dataset.currency ?? (result.target.market === 'BR' ? 'BRL' : 'USD');
  const fx = result.dataset.fx;

  const company = result.dataset.companyFacts ?? {};
  const snapshot = result.dataset.priceSnapshot ?? {};
  const ratios = result.dataset.keyRatiosSnapshot ?? {};

  const overviewRows: Array<[string, unknown]> = [
    ['Query', result.target.query],
    ['Resolved label', result.target.label],
    ['Ticker', result.target.ticker],
    ['Market', result.target.market],
    ['As of', result.asOf],
    ['Currency', currency],
    ['Price', snapshot.price ?? snapshot.regularMarketPrice ?? null],
    ['Price (USD)', snapshot.price_usd ?? null],
    ['Market cap', company.market_cap ?? snapshot.market_cap ?? null],
    ['Market cap (USD)', company.market_cap_usd ?? snapshot.market_cap_usd ?? null],
    ['Sector', company.sector ?? null],
    ['Industry', company.industry ?? null],
    ['Exchange', company.exchange ?? null],
  ];

  const metricsRows: Array<[string, unknown]> = [
    ['Revenue YoY', result.metrics.revenue_yoy_growth !== undefined ? formatPercent(result.metrics.revenue_yoy_growth) : undefined],
    ['Net income YoY', result.metrics.net_income_yoy_growth !== undefined ? formatPercent(result.metrics.net_income_yoy_growth) : undefined],
    ['CFO YoY', result.metrics.cfo_yoy_growth !== undefined ? formatPercent(result.metrics.cfo_yoy_growth) : undefined],
    ['FCF YoY', result.metrics.fcf_yoy_growth !== undefined ? formatPercent(result.metrics.fcf_yoy_growth) : undefined],
    ['CFO / Net income', result.metrics.cfo_to_net_income !== undefined ? formatNumber(result.metrics.cfo_to_net_income) : undefined],
    ['Accrual ratio', result.metrics.accrual_ratio !== undefined ? formatNumber(result.metrics.accrual_ratio) : undefined],
    ['Receivables YoY', result.metrics.receivables_yoy_growth !== undefined ? formatPercent(result.metrics.receivables_yoy_growth) : undefined],
    ['Receivables - Revenue growth', result.metrics.receivables_minus_revenue_growth !== undefined ? formatPercent(result.metrics.receivables_minus_revenue_growth) : undefined],
    ['Filings count', result.metrics.filings_count !== undefined ? formatNumber(result.metrics.filings_count) : undefined],
  ];

  const ratioRows: Array<[string, unknown]> = [
    ['P/E', ratios.pe_ratio ?? null],
    ['Forward P/E', ratios.forward_pe ?? null],
    ['Price-to-book', ratios.price_to_book ?? null],
    ['Dividend yield', ratios.dividend_yield ?? null],
    ['ROE', ratios.return_on_equity ?? null],
  ];

  const fxRows: Array<[string, unknown]> = fx
    ? [
        ['PTAX usd_brl', fx.usd_brl],
        ['PTAX timestamp', fx.timestamp],
        ['PTAX source', fx.sourceUrl],
      ]
    : [];

  const sourcesList = result.sources.length
    ? `<ul class="links">${result.sources
        .map(
          (u) =>
            `<li><a href="${escapeHtml(u)}" target="_blank" rel="noreferrer">${escapeHtml(u)}</a></li>`
        )
        .join('\n')}</ul>`
    : '<p class="muted">No sources recorded.</p>';

  const errorsBlock = result.errors.length
    ? `<pre class="errors">${escapeHtml(JSON.stringify(result.errors, null, 2))}</pre>`
    : '<p class="muted">No errors.</p>';

  const missingInputs = Array.isArray(result.metrics.missing_inputs)
    ? (result.metrics.missing_inputs as unknown[]).map(String)
    : [];
  const coverageNote = missingInputs.length
    ? `<p class="warn">Coverage gaps: ${escapeHtml(missingInputs.join(', '))}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Dexter — Fraud Screening Report — ${escapeHtml(result.target.label)}</title>
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
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; background: var(--bg); color: var(--text); }
      a { color: #b5c7ff; }
      .container { max-width: 1040px; margin: 0 auto; padding: 28px 18px 60px; }
      .top { display:flex; gap:12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
      .title { font-size: 20px; font-weight: 700; letter-spacing: 0.2px; }
      .subtitle { color: var(--muted); font-size: 13px; margin-top: 6px; }
      .pill { border: 1px solid var(--border); background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 999px; font-size: 12px; }
      .pill strong { font-weight: 700; }
      .grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; margin-top: 14px; }
      .card { grid-column: span 12; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 14px; }
      .card h2 { font-size: 14px; margin: 0 0 10px; letter-spacing: 0.2px; }
      .muted { color: var(--muted); }
      .warn { color: #ffd6a3; background: rgba(255,176,32,0.10); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,176,32,0.25); }
      table.kv { width:100%; border-collapse: collapse; }
      table.kv th { width: 220px; text-align: left; color: var(--muted); font-weight: 600; font-size: 12px; padding: 8px 0; vertical-align: top; }
      table.kv td { padding: 8px 0; border-top: 1px solid var(--border); font-size: 13px; }
      table.kv tr:first-child td { border-top: none; }
      .badge { display:inline-block; padding: 4px 8px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.3px; }
      .badge-high { background: rgba(255,92,122,0.16); border: 1px solid rgba(255,92,122,0.35); color: #ffd1da; }
      .badge-medium { background: rgba(255,176,32,0.14); border: 1px solid rgba(255,176,32,0.35); color: #ffe1ad; }
      .badge-low { background: rgba(94,203,138,0.14); border: 1px solid rgba(94,203,138,0.30); color: #d2ffe5; }
      .badge-none { background: rgba(127,139,189,0.16); border: 1px solid rgba(127,139,189,0.35); color: #d7ddff; }
      .flag { border-top: 1px solid var(--border); padding: 12px 0; }
      .flag:first-of-type { border-top: none; }
      .flag-head { display:flex; gap:10px; align-items: center; }
      .flag-title { font-weight: 700; }
      .flag-detail { margin-top: 6px; color: var(--muted); font-size: 13px; line-height: 1.35; }
      pre { margin: 10px 0 0; background: rgba(0,0,0,0.18); border: 1px solid var(--border); border-radius: 12px; padding: 10px; overflow: auto; color: #e7ebff; font-size: 12px; }
      ul.links { margin: 0; padding-left: 18px; }
      ul.links li { margin: 6px 0; }
      .footer { margin-top: 18px; color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="top">
        <div>
          <div class="title">Fraud / anomaly screening report — ${escapeHtml(result.target.label)}</div>
          <div class="subtitle">Heuristic screening over public-market data. This report is not proof of fraud.</div>
        </div>
        <div class="pill">
          <strong>Overall:</strong>
          <span class="badge badge-${escapeHtml(level === 'none' ? 'none' : level)}">${escapeHtml(String(level).toUpperCase())}</span>
          <span class="muted">${escapeHtml(String(count))} flags</span>
        </div>
      </div>

      <div class="grid">
        <section class="card">
          <h2>Disclaimer</h2>
          <p class="muted">${escapeHtml(result.disclaimer)}</p>
        </section>

        ${renderKeyValueTable('Overview', overviewRows)}

        ${renderKeyValueTable('Key metrics (computed)', metricsRows)}

        ${renderKeyValueTable('Key ratios (snapshot)', ratioRows)}

        ${fxRows.length ? renderKeyValueTable('FX (latest PTAX)', fxRows) : ''}

        <section class="card">
          <h2>Coverage</h2>
          ${coverageNote || '<p class="muted">All expected inputs present (based on this run).</p>'}
        </section>

        ${renderFlags(result.flags)}

        <section class="card">
          <h2>Sources</h2>
          ${sourcesList}
        </section>

        <section class="card">
          <h2>Errors</h2>
          ${errorsBlock}
        </section>
      </div>

      <div class="footer">
        Generated by Dexter. If you plan to publish or share results, avoid presenting heuristic flags as allegations; treat them as leads that require verification with primary filings and independent corroboration.
      </div>
    </div>
  </body>
</html>`;
}

