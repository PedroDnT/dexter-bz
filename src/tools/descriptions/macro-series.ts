/**
 * Rich description for the get_macro_series tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const MACRO_SERIES_DESCRIPTION = `
Fetch Brazilian macroeconomic time series from official sources (via the backend), such as inflation (IPCA, IPCA-15) and interest rates (CDI, Selic).

## When to Use

- You need **inflation history** (IPCA or IPCA-15) for a period
- You need **CDI** or **Selic** time series to compare against investments
- You want to compute **real returns** (deflating by IPCA) or **CDI-relative performance**
- You are analyzing Brazilian portfolios or fixed-income products and need a macro benchmark series

## When NOT to Use

- For stock or ETF prices (use financial_search or get_prices instead)
- For company fundamentals or key ratios (use financial_metrics)
- For PTAX FX rates (use the existing PTAX utilities, not this tool)

## Inputs

- **series_id**: One of:
  - ipca: Official Brazilian inflation index (IPCA)
  - ipca15: Preview inflation index (IPCA-15)
  - cdi: Interbank rate (Certificado de Depósito Interbancário)
  - selic: Policy interest rate
- **start_date / end_date**: Date range in YYYY-MM-DD format
- **frequency**: daily or monthly (defaults to monthly)

## Outputs

- A time series array with objects like { date: 'YYYY-MM-DD', value: number, ... }
- The exact structure may include additional metadata per point (e.g., original code, units), depending on backend implementation.

Use this tool as a building block for portfolio analytics (real returns, CDI-relative benchmarks, rate curves) rather than for raw display alone.
`.trim();
