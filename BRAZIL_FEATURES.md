# Brazil Feature Coverage

## Implemented now
- Prices (snapshot + history) via BRAPI/yfinance
- Fundamentals (income, balance sheet, cash flow) with BRL + USD (PTAX)
- Key ratios snapshot (best-effort) with BRL + USD (PTAX)
- Key ratios history computed from statements (best-effort)
- Company facts via BRAPI/yfinance
- News and analyst estimates via yfinance
- Filings metadata via CVM (DFP, ITR, FRE, IPE)
- PTAX FX conversion metadata on Brazil outputs

## Best-effort / known gaps
- **Segmented revenues (Brazil)**: No reliable structured source yet; consider CVM parsing or vendor coverage.
- **Insider trades (Brazil)**: IPE filings do not reliably map to insider trades; needs better CVM mapping.
- **Historical key ratios (Brazil)**: Computed from statements; some metrics may be missing depending on available inputs.
- **CVM filings text extraction**: Only metadata + document links returned; itemized parsing is not implemented.
- **ADR/BDR mapping**: ADR/BDR symbols (e.g., PBR) are treated as US unless mapped explicitly.
