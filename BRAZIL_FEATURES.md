# Brazil Feature Coverage

## Implemented now
- Prices (snapshot + history) via BRAPI/yfinance
- Fundamentals (income, balance sheet, cash flow) with BRL + USD (PTAX)
- Key ratios snapshot (best-effort) with BRL + USD (PTAX)
- Company facts via BRAPI/yfinance
- News and analyst estimates via yfinance
- Filings metadata via CVM (DFP, ITR, FRE, IPE)
- PTAX FX conversion metadata on Brazil outputs

## Best-effort / known gaps
- **Segmented revenues (Brazil)**: No reliable structured source yet; consider CVM parsing or vendor coverage.
- **Insider trades (Brazil)**: IPE disclosure metadata only; no transaction-level dataset yet.
- **Historical key ratios (Brazil)**: Only snapshot-level ratios are returned today.
- **CVM filings text extraction**: Only metadata + document links returned; itemized parsing is not implemented.
- **ADR/BDR mapping**: ADR/BDR symbols (e.g., PBR) are treated as US unless mapped explicitly.
