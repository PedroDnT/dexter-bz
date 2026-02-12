# Dexter 🤖

An autonomous financial research agent that thinks, plans, and learns. Dexter performs deep financial analysis using task planning, self-reflection, and real-time market data.

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Contributing](#contributing)
- [License](#license)

## Overview

Dexter transforms complex financial questions into actionable research plans, executes them using live market data, and validates results until confident, data-backed answers emerge.

**Key Features:**
- Autonomous task planning and execution
- Self-validation and iterative refinement
- Real-time access to financial statements and market data
- Support for US and Brazilian (B3) markets
- Built-in safety limits and loop detection

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

<img width="875" height="558" alt="Screenshot 2026-01-21 at 5 22 19 PM" src="https://github.com/user-attachments/assets/72d28363-69ea-4c74-a297-dfa60aa347f7" />


## Prerequisites

- [Bun](https://bun.sh) v1.0+ ([installation guide](https://bun.sh))
- [OpenAI API key](https://platform.openai.com/api-keys)
- [Financial Datasets API key](https://financialdatasets.ai)
- Optional: [Exa API key](https://exa.ai) for web search

## Installation

1. Clone and install:
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
bun install
```

2. Configure environment:
```bash
cp env.example .env
# Edit .env and add your API keys
```

Required keys:
```bash
OPENAI_API_KEY=your-key
FINANCIAL_DATASETS_API_KEY=your-key
```

Optional keys (see `env.example` for full list):
- Additional LLM providers: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`
- Web search: `EXASEARCH_API_KEY` or `TAVILY_API_KEY`
- Brazil markets: `BRAPI_TOKEN`

## Usage

Start Dexter in interactive mode:
```bash
bun start
```

Development mode with auto-reload:
```bash
bun dev
```

## Features

### 🇧🇷 Brazil (B3) Market Support

Access Brazilian market data via BRAPI and Yahoo Finance:
- Set `BRAPI_TOKEN` in `.env`
- Install Python dependencies: `pip install -r scripts/yfinance/requirements.txt`
- Outputs include both BRL and USD values (using latest PTAX rate)

See [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md) for details.

### 🕵️ Fraud/Anomaly Screening

Run automated red-flag screening on public market data:
```bash
bun run investigate --open
```

Generates HTML reports in `.dexter/reports/` analyzing:
- Earnings quality ratios
- Revenue and receivables trends
- Balance sheet anomalies
- Cash flow patterns

**Note**: Results are heuristic screening, not proof of fraud. Verify findings with primary sources.

### 📊 Evaluation Suite

Test agent performance against financial questions:
```bash
bun run src/evals/run.ts              # Run all questions
bun run src/evals/run.ts --sample 10  # Sample 10 questions
```

Uses LLM-as-judge scoring with LangSmith tracking.

### 🐛 Debugging

All agent activity is logged to `.dexter/scratchpad/*.jsonl` with:
- Query inputs
- Tool calls and results
- Reasoning steps

Example:
```json
{"type":"tool_result","toolName":"get_income_statements","args":{"ticker":"AAPL"},"llmSummary":"Retrieved 5 years of Apple income statements..."}
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Keep PRs small and focused
4. Run tests: `bun test`

For technical details, see [CLAUDE.md](CLAUDE.md).

## License

MIT License
