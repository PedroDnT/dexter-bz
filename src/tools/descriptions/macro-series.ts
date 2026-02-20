/**
 * Rich description for the get_macro_series tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const MACRO_SERIES_DESCRIPTION = `
Fetch Brazilian macroeconomic and bond-index time series from official sources (BCB SGS, IPCA/CDI backend), including inflation, rates, and IMA-B bond indices.

## When to Use

- You need **inflation history** (IPCA, IPCA-15, or IGP-M) for a period
- You need **CDI**, **Selic**, or **TR** time series to compare against investments
- You want to compute **real returns** (deflating by IPCA) or **CDI-relative performance**
- You need the **IMA-B**, **IMA-B 5**, or **IMA-B 5+** bond index as a fixed-income benchmark
- You are analyzing Brazilian portfolios or fixed-income products and need a macro benchmark series

## When NOT to Use

- For stock or ETF prices (use financial_search or get_prices instead)
- For company fundamentals or key ratios (use financial_metrics)
- For PTAX FX rates (use the existing PTAX utilities, not this tool)
- For Tesouro Direto (government bond) specific prices or buy/sell rates — use get_brazil_bonds instead

## Inputs

- **series_id**: One of:
  - **ipca**: Official Brazilian inflation index (IPCA, monthly)
  - **ipca15**: Preview inflation index (IPCA-15, monthly)
  - **cdi**: Interbank rate (CDI, daily or monthly)
  - **selic**: Policy interest rate (daily or monthly)
  - **igpm**: Broad price index IGP-M (monthly) — source: BCB SGS 189
  - **tr**: Reference rate TR (monthly) — source: BCB SGS 226
  - **imab**: IMA-B bond index – IPCA-linked Tesouro bonds (daily) — source: BCB SGS 12466
  - **imab5**: IMA-B 5 – short-duration IPCA-linked bonds ≤5y (daily) — source: BCB SGS 12467
  - **imab5plus**: IMA-B 5+ – long-duration IPCA-linked bonds >5y (daily) — source: BCB SGS 12468
- **start_date / end_date**: Date range in YYYY-MM-DD format
- **frequency**: daily or monthly (defaults to monthly; note igpm/tr are monthly-only, imab series are daily-only)

## Outputs

- **Rate series** (ipca, cdi, selic, igpm, tr): returns { series: [{ date, value }], meta: { label, unit, frequency } } where value is a percentage (e.g. 0.42 = 0.42%)
- **Index series** (imab, imab5, imab5plus): same structure but value is a cumulative index level

Use this tool as a building block for portfolio analytics (real returns, CDI-relative benchmarks, rate curves, fixed-income comparisons).
`.trim();
