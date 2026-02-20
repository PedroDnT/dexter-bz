/**
 * Rich description for the portfolio_performance tool.
 * Used in the system prompt to guide the LLM on when and how to use this tool.
 */
export const PORTFOLIO_PERFORMANCE_DESCRIPTION = `
Analyze historical portfolio performance versus benchmarks, including dollarized returns and risk metrics.

## When to Use

- The user asks how their **portfolio has performed** over a period
- Compare a portfolio to benchmarks like **Ibovespa (ibov)** or **S&P 500 (sp500)**
- Need **dollarized performance** for Brazil + US holdings
- Compute portfolio-level **total and annualized return**
- Compute **volatility, Sharpe ratio, and max drawdown**
- Measure **tracking error** and relative return versus a benchmark

## When NOT to Use

- Single-stock questions (use financial_search or financial_metrics)
- General market research or news (use financial_search or web_search)
- Deep fundamental analysis of one company (use financial_metrics)
- Tax optimization or portfolio strategy advice (use ask_portfolio_advisor or ask_brazil_tax_expert)

## Inputs

- **holdings**: Array of { ticker, weight } describing the static-weight portfolio
- **start_date / end_date**: Analysis window in YYYY-MM-DD format
- **benchmarks**: Named indices such as ibov (BOVA11 proxy) or sp500 (SPY proxy)
- **return_frequency**: daily, weekly, or monthly (daily is default)
- **risk_free**: Optional risk-free rate spec (defaults to a constant 4% annual rate)

## Outputs

- Portfolio summary metrics: annualized return, annualized volatility, Sharpe ratio, max drawdown
- Benchmark metrics with **relative return** and **tracking error** vs the portfolio
- Time series of portfolio and benchmark returns for charting
- Notes describing assumptions (buy-and-hold weights, latest PTAX for BRL→USD conversions)
`.trim();
