---
name: brazil-market
description: Use for Brazil/B3 tickers, CVM filings (DFP/ITR/FRE/IPE), PTAX FX conversion, B3 ETF/FII listings, or when users ask about Brazilian companies, funds, or BRL/USD conversions.
---

# Brazil Market Skill

## When to use
- User asks about B3 companies, FIIs (REITs), or ETFs (e.g., PETR4, VALE3, BOVA11, QBTC11, KNCR11)
- Questions mention CVM, DFP, ITR, FRE, IPE, PTAX, B3, or Bovespa
- Requests need BRL values with USD conversions
- User asks for a **ranking or list** of B3 funds/ETFs (top gainers, by sector, QTD, YTD)

## Ticker format
- Accept both `PETR4` and `PETR4.SA` — both work
- Canonical B3 format: 4 letters + 1-2 digits → `PETR4`, `VALE3`, `ITUB4`
- **ETFs and FIIs always end in `11`** and are classified as `type=fund` in BRAPI:
  - ETFs: `BOVA11` (Ibovespa), `IVVB11` (S&P500), `SMAL11` (small cap), `QBTC11` (Bitcoin), `QETH11` (Ether)
  - FIIs (real estate funds): `KNRI11`, `XPML11`, `HGLG11`, `KNCR11`
- Regular stocks end in `3`, `4`, `5`, `6` (e.g., `PETR3`, `PETR4`, `VALE3`)

---

## Tool: `financial_search` — primary tool for all Brazil data

Pass natural-language queries; the router calls the right underlying tool automatically.

### Price & market data
```
"current price and market data for PETR4"
"VALE3 price history last 6 months"
"BOVA11 ETF current quote"
```

### Fundamentals (income, balance sheet, cash flow)
```
"PETR4 income statements last 3 years"
"VALE3 balance sheet annual"
"ITUB4 cash flow statements"
```
> Results include both BRL fields and `*_usd` fields converted at latest PTAX.

### Key ratios & valuation
```
"PETR4 P/E ratio and key valuation metrics"
"VALE3 dividend yield and key ratios"
```

### Company facts
```
"PETR4 company overview sector industry employees"
"VALE3 company facts"
```

### News
```
"latest news about PETR4"
"VALE3 recent announcements"
```

### Analyst estimates
```
"PETR4 analyst estimates and price targets"
```

---

## Tool: `financial_search` — CVM filings

CVM filing types (not SEC):
| Type | Equivalent | Description |
|------|-----------|-------------|
| DFP  | 10-K      | Annual financial statements |
| ITR  | 10-Q      | Quarterly financial statements |
| IPE  | 8-K       | Material events / press releases |
| FRE  | 20-F/proxy| Reference form (annual reference) |

```
"PETR4 DFP annual filings"
"VALE3 ITR quarterly filings 2024"
"ITUB4 IPE event filings"
```

---

## Listing B3 funds and ETFs (BRAPI `/api/quote/list`)

When the user asks for a **list or ranking** of B3 ETFs or FIIs — e.g., "top ETFs today", "best FIIs", "best performers" — use BRAPI's list endpoint with `type=fund`. **Both ETFs and FIIs are `type=fund` in BRAPI; they all have tickers ending in `11`.**

```
GET https://brapi.dev/api/quote/list
  ?type=fund          ← required: covers all ETFs + FIIs (ticker ends in 11)
  &sortBy=change      ← sort by: name | close | change | volume | market_cap_basic
  &sortOrder=desc     ← asc | desc
  &limit=20           ← items per page (max 100)
  &page=1
  &search=BOVA        ← optional: filter by ticker fragment
  &token=<BRAPI_TOKEN>
```

**Known limitation:** BRAPI does not expose QTD/YTD/MTD period-return fields. `change` is always today's intraday return. For multi-period ranking, you would need to fetch historical prices per ticker and compute returns manually — acknowledge this to the user rather than presenting today's `change` as a period return.

To get a quote for specific tickers (including ETFs):
```
GET https://brapi.dev/api/quote/BOVA11,IVVB11,SMAL11,QBTC11,QETH11
  ?token=<BRAPI_TOKEN>
```

The `financial_search` tool handles this automatically — just query:
```
"list top 20 B3 ETFs and funds by today's performance"
"BOVA11 IVVB11 SMAL11 current quotes"
```

---

## Currency & FX
- All Brazil tool outputs include **BRL** values AND `*_usd` equivalents.
- FX uses the **latest PTAX** rate (from BCB), **not** a historical period-end rate.
- PTAX metadata `{ ptax_rate, ptax_date, ptax_source }` is included in results — always mention it.

---

## Common pitfalls
- **QTRD / unknown tickers**: If BRAPI returns `NOT_FOUND`, the ticker likely does not trade on B3. Confirm with user. Suggest `/api/quote/list?search=<fragment>` to discover similar tickers.
- **Fundamentals for FIIs/ETFs**: Most funds don't have income statements. Use price/key-ratios data instead.
- **CVM filings for foreign companies listed as BDRs**: CVM filings may be limited; suggest SEC filings for the underlying foreign issuer.
- **QTD/YTD ranking**: BRAPI only has today's `change%`. Tell the user explicitly if they ask for period-based ranking.
