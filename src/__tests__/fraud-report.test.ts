import { describe, it, expect } from 'bun:test';
import { renderFraudReportHtml } from '../pipelines/fraud/report.js';
import type { FraudInvestigationResult } from '../pipelines/fraud/types.js';

function makeResult(overrides: Partial<FraudInvestigationResult> = {}): FraudInvestigationResult {
  return {
    target: {
      query: 'AAPL',
      label: 'Apple Inc.',
      ticker: 'AAPL',
      market: 'US',
      resolvedFrom: 'ticker',
    },
    asOf: '2025-06-01T00:00:00Z',
    dataset: {
      priceSnapshot: { price: 200 },
      currency: 'USD',
    },
    flags: [],
    metrics: {},
    sources: [],
    errors: [],
    disclaimer: 'This is a heuristic screening.',
    ...overrides,
  };
}

describe('renderFraudReportHtml', () => {
  it('produces valid HTML document', () => {
    const html = renderFraudReportHtml(makeResult());
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<title>');
    expect(html).toContain('</title>');
  });

  it('includes the target label in the title', () => {
    const html = renderFraudReportHtml(makeResult());
    expect(html).toContain('Apple Inc.');
  });

  it('shows "NONE" badge when no flags', () => {
    const html = renderFraudReportHtml(makeResult({ flags: [] }));
    expect(html).toContain('NONE');
    expect(html).toContain('0 flags');
  });

  it('shows "HIGH" badge when high severity flag present', () => {
    const html = renderFraudReportHtml(
      makeResult({
        flags: [
          {
            id: 'test_high',
            severity: 'high',
            title: 'Test high severity',
            detail: 'Detail here',
          },
        ],
      })
    );
    expect(html).toContain('HIGH');
    expect(html).toContain('1 flags');
  });

  it('shows flag details and evidence', () => {
    const html = renderFraudReportHtml(
      makeResult({
        flags: [
          {
            id: 'test_flag',
            severity: 'medium',
            title: 'Revenue concern',
            detail: 'Revenue is suspicious',
            evidence: { growth: 0.75 },
          },
        ],
      })
    );
    expect(html).toContain('Revenue concern');
    expect(html).toContain('Revenue is suspicious');
    expect(html).toContain('0.75');
  });

  it('displays "No heuristic flags triggered" when no flags', () => {
    const html = renderFraudReportHtml(makeResult({ flags: [] }));
    expect(html).toContain('No heuristic flags triggered');
  });

  it('escapes HTML in user-controlled fields (XSS protection)', () => {
    const html = renderFraudReportHtml(
      makeResult({
        target: {
          query: '<script>alert("xss")</script>',
          label: '<img src=x onerror=alert(1)>',
          ticker: 'AAPL',
          market: 'US',
          resolvedFrom: 'ticker',
        },
      })
    );
    // Script tags are escaped: < and > replaced with HTML entities
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    // Img tag is escaped: angle brackets replaced with entities
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });

  it('includes source URLs as links', () => {
    const html = renderFraudReportHtml(
      makeResult({
        sources: ['https://example.com/api/data', 'https://other.com/feed'],
      })
    );
    expect(html).toContain('href="https://example.com/api/data"');
    expect(html).toContain('href="https://other.com/feed"');
    expect(html).toContain('target="_blank"');
  });

  it('displays "No sources recorded" when sources array is empty', () => {
    const html = renderFraudReportHtml(makeResult({ sources: [] }));
    expect(html).toContain('No sources recorded');
  });

  it('displays errors when present', () => {
    const html = renderFraudReportHtml(
      makeResult({
        errors: [{ step: 'income_statements', error: 'API timeout' }],
      })
    );
    expect(html).toContain('income_statements');
    expect(html).toContain('API timeout');
  });

  it('displays "No errors" when errors array is empty', () => {
    const html = renderFraudReportHtml(makeResult({ errors: [] }));
    expect(html).toContain('No errors');
  });

  it('includes metrics in the report', () => {
    const html = renderFraudReportHtml(
      makeResult({
        metrics: {
          revenue_yoy_growth: 0.25,
          net_income_yoy_growth: 0.1,
          filings_count: 5,
        },
      })
    );
    expect(html).toContain('25.0%');
    expect(html).toContain('10.0%');
  });

  it('includes disclaimer text', () => {
    const html = renderFraudReportHtml(makeResult());
    expect(html).toContain('This is a heuristic screening');
  });

  it('handles Brazil market with BRL currency', () => {
    const html = renderFraudReportHtml(
      makeResult({
        target: {
          query: 'PETR4',
          label: 'Petrobras',
          ticker: 'PETR4',
          market: 'BR',
          resolvedFrom: 'ticker',
        },
        dataset: {
          currency: 'BRL',
          fx: { usd_brl: 5.25, timestamp: '2025-01-01T00:00:00Z', sourceUrl: 'https://bcb.gov.br' },
        },
      })
    );
    expect(html).toContain('BRL');
    expect(html).toContain('PTAX');
    expect(html).toContain('5.25');
  });

  it('displays coverage warning when missing_inputs exist', () => {
    const html = renderFraudReportHtml(
      makeResult({
        metrics: {
          missing_inputs: ['price_snapshot', 'income_statements', 'balance_sheets'],
        },
      })
    );
    expect(html).toContain('Coverage gaps');
    expect(html).toContain('price_snapshot');
    expect(html).toContain('income_statements');
  });

  it('shows "All expected inputs present" when no missing inputs', () => {
    const html = renderFraudReportHtml(makeResult({ metrics: {} }));
    expect(html).toContain('All expected inputs present');
  });

  it('sorts flags by severity (high first)', () => {
    const html = renderFraudReportHtml(
      makeResult({
        flags: [
          { id: 'low_flag', severity: 'low', title: 'Low flag', detail: 'd' },
          { id: 'high_flag', severity: 'high', title: 'High flag', detail: 'd' },
          { id: 'med_flag', severity: 'medium', title: 'Med flag', detail: 'd' },
        ],
      })
    );
    const highPos = html.indexOf('High flag');
    const medPos = html.indexOf('Med flag');
    const lowPos = html.indexOf('Low flag');
    expect(highPos).toBeLessThan(medPos);
    expect(medPos).toBeLessThan(lowPos);
  });
});
