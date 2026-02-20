---
name: portfolio-performance
description: Analyze portfolio performance versus benchmarks. Triggers when the user asks about "portfolio performance", "how has my portfolio done", "compare my portfolio to S&P 500 or Ibovespa", "portfolio returns", "Sharpe ratio for my portfolio", "track my investments", "dollarized P&L", or "portfolio vs benchmark".
---

# Portfolio Performance Analyzer

## Workflow Checklist

Copy and track progress:
```
Portfolio Performance Analysis:
- [ ] Step 1: Collect portfolio positions
- [ ] Step 2: Fetch historical prices for holdings
- [ ] Step 3: Fetch benchmark prices
- [ ] Step 4: Calculate position-level returns and dollarized P&L
- [ ] Step 5: Build portfolio daily returns series
- [ ] Step 6: Compute portfolio-level metrics (return, volatility, Sharpe, max drawdown)
- [ ] Step 7: Compare to benchmarks (relative return, alpha, beta)
- [ ] Step 8: Present full report
```

## Step 1: Collect Portfolio Positions

Ask the user (or use what they provided) for each holding:

| Field | Required | Notes |
|---|---|---|
| Ticker | Yes | e.g. AAPL, PETR4 |
| Shares | Yes | Number of shares |
| Avg Cost | Recommended | Price paid per share for P&L |
| Purchase Date | Recommended | Defines performance start; default 1 year ago |
| Currency | Auto-detected | BRL if Brazilian ticker, else USD |

**Default lookback:** 1 year ending today when no dates are provided.

## Step 2: Fetch Historical Prices for Holdings

For each ticker call `financial_search`:

**Query:** `"[TICKER] daily prices from [start_date] to [end_date]"`

Extract: a time-sorted series of `{ date, close }` rows.

Normalize each series to an index starting at **1.0** on the first date:
```
index[t] = close[t] / close[start]
```
This makes return comparison consistent regardless of price level.

**Brazil note:** If any ticker is a Brazilian asset (e.g. PETR4, BOVA11), price results will include `_usd` fields and an `fx` object with `usd_brl` and `ptax_date`. Use the `close_usd` field for USD-converted returns.

## Step 3: Fetch Benchmark Prices

Select the appropriate benchmark(s) for the portfolio:

| Portfolio type | Benchmark | Ticker |
|---|---|---|
| US stocks | S&P 500 | SPY |
| Brazil stocks | Ibovespa | BOVA11 |
| Mixed | Both | SPY + BOVA11 |

**Query:** `"SPY daily prices from [start_date] to [end_date]"`

Normalize the benchmark to 1.0 on the same start date as the portfolio.

## Step 4: Calculate Position-Level Returns and Dollarized P&L

For each holding compute the following. If `avg_cost` is unknown, use `start_date` close as the cost basis.

| Metric | Formula |
|---|---|
| Total Return % | `(end_price / avg_cost - 1) × 100` |
| Dollar P&L | `(end_price - avg_cost) × shares` |
| Cost Basis | `avg_cost × shares` |
| Current Value | `end_price × shares` |
| Portfolio Weight | `current_value / Σ current_value` |

**Brazil P&L in USD:** If any holding is BRL-denominated, also compute dollar values using the `fx.usd_brl` rate from the price response:
```
cost_basis_usd = cost_basis_brl / purchase_fx_rate   (use current PTAX if purchase rate unknown)
current_value_usd = current_value_brl / current_fx_rate
gain_loss_usd = current_value_usd - cost_basis_usd
```

## Step 5: Build Portfolio Daily Returns Series

Compute weighted daily returns for the portfolio:

```
daily_return[t] = Σ (weight_i × daily_return_i[t])
```

where `daily_return_i[t] = close_i[t] / close_i[t-1] - 1`.

Use **beginning-of-period weights** (buy-and-hold; do not rebalance). For equal-weight portfolios use `weight_i = 1 / N`.

Cumulative portfolio return at any date:
```
cumulative[t] = Π (1 + daily_return[τ]) for τ from start to t
```

## Step 6: Compute Portfolio-Level Metrics

Using the daily returns series from Step 5:

### Total Return
```
total_return = cumulative[end] - 1
```

### Annualized Return
```
n_years = trading_days / 252
annualized_return = (1 + total_return)^(1/n_years) - 1
```

### Annualized Volatility
```
volatility = stdev(daily_returns) × √252
```

### Sharpe Ratio (annualized)

Use current risk-free rate appropriate for the portfolio currency:
- USD portfolio: **5.0%** (approx US T-bill / Fed Funds)
- BRL portfolio: **10.5%** (approx Selic rate)

```
daily_rf = (1 + annual_rf)^(1/252) - 1
excess_returns = daily_returns - daily_rf
sharpe = mean(excess_returns) / stdev(excess_returns) × √252
```

**Interpretation:** >1.0 = good, >2.0 = excellent, <0 = return below risk-free rate.

### Maximum Drawdown
```
peak[t] = max(cumulative[τ]) for τ ≤ t
drawdown[t] = (cumulative[t] - peak[t]) / peak[t]
max_drawdown = min(drawdown[t])
```

### Calmar Ratio (optional)
```
calmar = annualized_return / |max_drawdown|
```

## Step 7: Benchmark Comparison

Compute the same metrics (total return, volatility, Sharpe, max drawdown) for each benchmark using its daily returns series.

Then compute relative metrics:

| Metric | Formula |
|---|---|
| Alpha (absolute) | `portfolio_return - benchmark_return` |
| Relative Sharpe | `portfolio_sharpe - benchmark_sharpe` |
| Beta | `cov(portfolio_daily, benchmark_daily) / var(benchmark_daily)` |
| Tracking Error | `stdev(portfolio_daily - benchmark_daily) × √252` |
| Information Ratio | `(portfolio_return - benchmark_return) / tracking_error` |

**Beta interpretation:** β > 1 = more volatile than benchmark; β < 1 = less volatile; β ≈ 0 = uncorrelated.

## Step 8: Present Full Report

### Output Format

---

**Portfolio Performance Report**
Period: [start_date] → [end_date] ([N] trading days)

---

#### Holdings Performance

| Ticker | Shares | Avg Cost | Current Price | Weight | Return | vs Benchmark |
|---|---|---|---|---|---|---|
| AAPL | 50 | $150.00 | $185.00 | 45% | +23.3% | +8.2% |
| MSFT | 30 | $240.00 | $295.00 | 55% | +22.9% | +7.8% |

#### Dollarized P&L

| Ticker | Cost Basis | Current Value | Gain / Loss | Return % |
|---|---|---|---|---|
| AAPL | $7,500 | $9,250 | **+$1,750** | +23.3% |
| MSFT | $7,200 | $8,850 | **+$1,650** | +22.9% |
| **Total** | **$14,700** | **$18,100** | **+$3,400** | **+23.1%** |

*Brazil positions: show BRL and USD columns side-by-side using PTAX rate.*

#### Portfolio vs Benchmark

| Metric | Portfolio | SPY | Difference |
|---|---|---|---|
| Total Return | +23.1% | +15.1% | **+8.0%** |
| Annualized Return | +23.1% | +15.1% | +8.0% |
| Annualized Volatility | 18.5% | 15.0% | +3.5% |
| Sharpe Ratio | 0.98 | 0.68 | **+0.30** |
| Max Drawdown | -12.3% | -10.5% | -1.8% |
| Beta | 1.15 | 1.00 | — |

#### Key Insights

- **Best performer:** [ticker] (+X.X%) — [brief reason if known from news/context]
- **Worst performer:** [ticker] (-X.X%) — [brief reason if known]
- **Alpha vs benchmark:** +X.X pp — portfolio [outperformed / underperformed]
- **Risk-adjusted (Sharpe):** [value] vs benchmark [value] — [better / worse] risk-adjusted return
- **Max drawdown:** [value] — portfolio [recovered / still below] peak

#### Caveats

- Returns are **price returns** (excludes dividends) unless adjusted-close prices were used.
- Sharpe ratio assumes a normal distribution of daily returns.
- Beta and correlations require sufficient history (≥ 60 trading days) to be meaningful.
- Brazil positions:
  - **Current values** use the latest PTAX rate.
  - **Cost basis** conversion uses the original purchase-date FX rate when available; when that rate is unavailable, the current PTAX rate is used as a fallback.
  - This fallback tends to **overstate USD losses / understate USD gains** when BRL has depreciated and **overstate USD gains / understate USD losses** when BRL has appreciated. For precise historical P&L, provide the purchase-date exchange rate.
- Past performance does not guarantee future results.
