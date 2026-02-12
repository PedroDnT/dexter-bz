# Brazil Market Support

This document describes Dexter's coverage of Brazilian (B3) market data.

## Implemented Features

- **Prices**: Current and historical via BRAPI/yfinance
- **Fundamentals**: Income statements, balance sheets, cash flows with dual currency (BRL + USD)
- **Key Ratios**: Snapshot ratios with dual currency
- **Company Information**: Basic company facts via BRAPI/yfinance
- **News & Estimates**: Via yfinance
- **Filings Metadata**: CVM filings (DFP, ITR, FRE, IPE) with document links
- **Currency Conversion**: Multi-source PTAX rate (BCB → AwesomeAPI → ExchangeRate-API fallback chain) included in all Brazil outputs with graceful degradation

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

## PTAX Rate Sources

The system attempts to fetch USD/BRL exchange rates from multiple sources in order:

1. **BCB (Banco Central do Brasil)** - Official source, tried first
   - Endpoint: `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/`
   - Fetches last 10 days of rates, selects latest "Fechamento" rate

2. **AwesomeAPI** - Brazilian financial data API, fast and reliable
   - Endpoint: `https://economia.awesomeapi.com.br/json/last/USD-BRL`
   - Free service, typically has <500ms latency

3. **ExchangeRate-API** - International fallback
   - Endpoint: `https://api.exchangerate-api.com/v4/latest/USD`
   - Worldwide coverage, good uptime

All sources have 10-second timeouts. If all sources fail, tools return BRL data without USD conversion and include a note in the response. Rate is cached for 6 hours to minimize API calls.
