---
name: brazil-market
description: Use for Brazil/B3 tickers, CVM filings (DFP/ITR/FRE/IPE), PTAX FX conversion, or when users ask about Brazilian companies or BRL/USD conversions.
---

# Brazil Market Skill

## When to use
- User asks about Brazil/B3 companies (e.g., PETR4, VALE3, ITUB4, or PETR4.SA)
- Questions mention CVM, DFP, ITR, FRE, IPE, or PTAX
- Requests need BRL values and USD conversions

## Ticker format
- Accept both `PETR4` and `PETR4.SA`
- Canonical B3 symbol is `XXXXN` (e.g., `PETR4`)

## Tool usage
- Use `financial_search` for prices, fundamentals, key ratios, company facts, news, or estimates.
- Use `get_filings` for CVM filings metadata:
  - **DFP** = annual filings (10-K equivalent)
  - **ITR** = quarterly filings (10-Q equivalent)
  - **IPE** = event filings (8-K equivalent)
  - **FRE** = reference form
- Use `get_10K_filing_items` / `get_10Q_filing_items` / `get_8K_filing_items` for Brazil document links and metadata (CVM does not use SEC item structure).

## Currency & FX
- Brazil outputs include **BRL** values plus **USD** equivalents using the latest **PTAX** rate.
- The FX metadata is included in results; mention that PTAX is latest (not period-end).

## Caveats
- Some Brazil features are best-effort; check `BRAZIL_FEATURES.md` for current gaps.
