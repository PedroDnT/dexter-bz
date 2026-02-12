# Brazil Market Support

This document describes Dexter's coverage of Brazilian (B3) market data.

## Implemented Features

- **Prices**: Current and historical via BRAPI/yfinance
- **Fundamentals**: Income statements, balance sheets, cash flows with dual currency (BRL + USD)
- **Key Ratios**: Snapshot ratios with dual currency
- **Company Information**: Basic company facts via BRAPI/yfinance
- **News & Estimates**: Via yfinance
- **Filings Metadata**: CVM filings (DFP, ITR, FRE, IPE) with document links
- **Currency Conversion**: Latest PTAX (BCB) rate metadata included in all Brazil outputs

## Known Limitations

- **Segmented Revenue**: No reliable structured source available yet
- **Insider Trades**: IPE filings don't reliably map to insider transactions
- **Historical Ratios**: Only current snapshot ratios available
- **CVM Text Extraction**: Metadata and links only; full text parsing not implemented
- **ADR/BDR Mapping**: Symbols like PBR are treated as US securities unless explicitly mapped

## Configuration

Required environment variables:
```bash
BRAPI_TOKEN=your-token
```

Optional (for yfinance fallback):
```bash
YFINANCE_PYTHON_BIN=python3  # Default: python3
```

Python dependencies:
```bash
pip install -r scripts/yfinance/requirements.txt
```

## Ticker Formats

Both formats are supported:
- B3 format: `PETR4`, `VALE3`, `ITUB4`
- Yahoo format: `PETR4.SA`, `VALE3.SA`, `ITUB4.SA`

## Output Format

All Brazil market outputs include:
- BRL values (native currency)
- USD equivalents (converted using latest PTAX)
- PTAX metadata: `{ ptax_rate, ptax_date, ptax_source }`

Note: USD conversions use the latest available PTAX rate, not historical rates from statement dates.
