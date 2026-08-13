# Dexter BZ 🤖

> **Built on [virattt/dexter](https://github.com/virattt/dexter)** by [@virattt](https://github.com/virattt).
> The autonomous research agent — task planning, self-reflection, self-validation, the tool
> loop and the CLI — is his work, used here under the MIT License.
>
> This repository adds a **Brazil market layer** on top of it:
> a CVM filings provider, BCB/PTAX FX normalisation, BRAPI/B3 pricing, key ratios,
> segments, insider trades, a fraud/anomaly screening pipeline, and a portfolio
> performance analyser. See [What this fork adds](#what-this-fork-adds).

An autonomous financial research agent that thinks, plans, and learns. Dexter decomposes
complex financial questions into research plans, executes them against live market data,
and validates its own results until it can give a data-backed answer.

<img width="1098" height="659" alt="Dexter interface" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [What this fork adds](#what-this-fork-adds)
- [Development](#development)
- [Documentation](#documentation)
- [Credits](#credits)
- [License](#license)

## Features

- 🧠 **Intelligent Task Planning** — decomposes complex queries into research steps
- 🔄 **Autonomous Execution** — selects and executes the right tools to gather financial data
- ✅ **Self-Validation** — checks its own work and iterates until complete
- 📊 **Real-Time Data** — fundamentals, prices, filings, and market data
- 🌎 **Brazil Support** — B3 market data and CVM filings as first-class sources
- 🕵️ **Fraud Screening** — pipeline for anomaly detection and red flags
- 🛡️ **Safety Features** — loop detection and step limits prevent runaway execution
- 📈 **Portfolio Analytics** — performance vs benchmarks with dollarised returns, Sharpe, drawdowns

<img width="875" height="558" alt="Dexter session" src="https://github.com/user-attachments/assets/72d28363-69ea-4c74-a297-dfa60aa347f7" />

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+ ([installation guide](https://bun.sh/docs/installation))
- [OpenAI API key](https://platform.openai.com/api-keys)
- [Financial Datasets API key](https://financialdatasets.ai)
- Optional: [Exa API key](https://exa.ai) for web search
- Optional: [BRAPI token](https://brapi.dev) for B3 pricing
- Optional: Python 3, for the Yahoo Finance bridge used by some B3 lookups

```bash
git clone https://github.com/PedroDnT/dexter-bz.git
cd dexter-bz
bun install

# Set up environment
cp env.example .env
# Edit .env and add your OPENAI_API_KEY and FINANCIAL_DATASETS_API_KEY
```

For Brazil coverage:

```bash
# Add BRAPI_TOKEN=your-token to .env
pip install -r scripts/yfinance/requirements.txt
```

## Usage

```bash
bun start                # Interactive mode
bun dev                  # Development mode with watch
bun run investigate      # Run the fraud screening pipeline
```

## What this fork adds

Everything below is specific to this repository and does not exist upstream.

### 🇧🇷 Brazil (B3) market support

Brazilian equities via BRAPI and Yahoo Finance, with CVM as the filings source.

| Capability | Implementation |
|---|---|
| CVM filings (DFP / ITR / FRE / IPE) | `src/tools/finance/providers/cvm.ts` |
| PTAX + BCB SGS series | `src/tools/finance/providers/ptax.ts`, `providers/bcb-sgs.ts` |
| BRAPI / B3 pricing | `src/tools/finance/providers/brapi.ts`, `providers/yfinance.ts` |
| Key ratios | `src/tools/finance/key-ratios.ts` |
| Segments | `src/tools/finance/segments.ts` |
| Insider trades | `src/tools/finance/insider_trades.ts` |
| Brazilian bonds, macro series | `src/tools/finance/brazil-bonds.ts`, `macro-series.ts` |

All Brazil outputs carry both BRL and USD values using the latest PTAX (BCB) rate, with a
BCB → AwesomeAPI → ExchangeRate-API fallback chain.

**Known coverage gaps** — segmented revenue has no reliable structured source, and IPE
filings do not map cleanly onto insider transactions. Both tools record the gap rather
than guessing. See [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md).

### 🕵️ Fraud & anomaly screening

Automated red-flag screening over public market data (`src/pipelines/`):

```bash
bun run investigate --open               # All targets, then open the reports
bun run investigate --target AAPL        # Single ticker
bun run investigate --targets AAPL,MSFT  # Multiple tickers
```

Generates HTML reports in `.dexter/reports/` covering earnings-quality ratios, revenue
and receivables trends, balance-sheet anomalies, and cash-flow patterns.

> **Note:** this is heuristic screening, not proof of fraud. Always verify findings
> against primary sources.

### 📈 Portfolio performance analyser

Evaluates how a portfolio performed against benchmarks over time
(`src/tools/finance/portfolio-performance.ts`, `portfolio-math.ts`):

- Aggregates holdings from tickers and weights into a unified return series
- Compares against benchmarks such as S&P 500 (SPY) or Ibovespa (BOVA11)
- Computes total and annualised return, volatility, Sharpe ratio, and max drawdown
- Produces a dollarised view for Brazilian assets when PTAX data is available

Example prompts from the interactive CLI:

- *"Analyze this portfolio vs S&P 500 from 2020 to today: AAPL 60%, MSFT 40%"*
- *"How has my Brazil portfolio (PETR4 40%, VALE3 30%, BOVA11 30%) done vs Ibovespa?"*

See `src/skills/portfolio-performance/SKILL.md`.

## Development

```bash
bun test            # Run the test suite
bun run typecheck   # TypeScript type checking
```

### Debugging

All tool calls are logged to `.dexter/scratchpad/<timestamp>.jsonl`:

```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL"},"result":{},"llmSummary":"Retrieved 5 years of Apple data..."}
```

Each entry shows the tool name, arguments, raw results, and the model's interpretation.

### Configuration

Optional environment variables:

```bash
# AI providers (choose one or more)
ANTHROPIC_API_KEY=sk-...        # Claude models
GOOGLE_API_KEY=...              # Gemini models
XAI_API_KEY=...                 # Grok models
OPENROUTER_API_KEY=...          # OpenRouter
OLLAMA_BASE_URL=http://...      # Local Ollama

# Web search (optional)
EXASEARCH_API_KEY=...           # Exa search (preferred)
TAVILY_API_KEY=...              # Tavily search (fallback)

# Brazil (optional)
BRAPI_TOKEN=...                 # B3 pricing
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — architecture and developer guide
- [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md) — Brazil market feature coverage and known gaps

## Contributing

Contributions welcome. Please keep PRs small and focused, and run `bun test` before
submitting.

## Credits

This project is built on **[virattt/dexter](https://github.com/virattt/dexter)** by
[Virat Singh](https://github.com/virattt) — the agent architecture, planning loop,
self-validation, tool dispatch and terminal UI originate there and remain his work.

This fork contributes the Brazil market layer described in
[What this fork adds](#what-this-fork-adds).

## License

MIT — see [LICENSE](LICENSE). The original work is Copyright (c) virattt; the Brazil
market additions in this repository are Copyright (c) 2026 Pedro Domingues. Both are
released under the MIT License.
