# Dexter 🤖

An autonomous financial research agent that thinks, plans, and learns. Built specifically for financial research using task planning, self-reflection, and real-time market data.

<img width="1098" height="659" alt="Dexter interface" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## Features

- 🧠 **Intelligent Task Planning** - Automatically decomposes complex queries into research steps
- 🔄 **Autonomous Execution** - Selects and executes the right tools to gather financial data
- ✅ **Self-Validation** - Checks its own work and iterates until complete
- 📊 **Real-Time Data** - Access to fundamentals, prices, filings, and market data
- 🌎 **Brazil Support** - First-class support for B3 market data and CVM filings
- 🕵️ **Fraud Detection** - Built-in pipeline for anomaly screening and red-flag detection
- ��️ **Safety Features** - Loop detection and step limits prevent runaway execution

[![Twitter Follow](https://img.shields.io/twitter/follow/virattt?style=social)](https://twitter.com/virattt)

## Quick Start

### Prerequisites

- [Bun](https://bun.com) v1.0+ ([install guide](https://bun.com/docs/installation))
- [OpenAI API key](https://platform.openai.com/api-keys)
- [Financial Datasets API key](https://financialdatasets.ai)

### Installation

```bash
# Clone and install
git clone https://github.com/virattt/dexter.git
cd dexter
bun install

# Set up environment
cp env.example .env
# Edit .env and add your OPENAI_API_KEY and FINANCIAL_DATASETS_API_KEY
```

### Usage

```bash
bun start                # Interactive mode
bun dev                  # Development mode with watch
bun run investigate      # Run fraud screening pipeline
```

## Advanced Features

### 🇧🇷 Brazil (B3) Market Support

Dexter includes first-class support for Brazilian stocks with data from BRAPI and Yahoo Finance.

**Setup:**
```bash
# Add to .env
BRAPI_TOKEN=your-token

# Install Python dependencies
pip install -r scripts/yfinance/requirements.txt
```

All Brazil outputs include both BRL and USD values using the latest PTAX (BCB) exchange rate. See [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md) for details.

### 🕵️ Fraud & Anomaly Screening

Run automated red-flag detection across financial statements:

```bash
bun run investigate --open              # All targets + open reports
bun run investigate --target AAPL        # Single ticker
bun run investigate --targets AAPL,MSFT  # Multiple tickers
```

Reports are saved to `.dexter/reports/` with HTML visualizations of detected anomalies.

**Note**: This is heuristic screening, not proof of fraud. Always verify findings with primary sources.

## Development

### Testing & Evaluation

```bash
bun test                        # Run test suite
bun run typecheck              # TypeScript type checking
bun run src/evals/run.ts       # Run evaluation suite
```

The evaluation suite tests Dexter against financial questions using LangSmith tracking and LLM-as-judge scoring.

### Debugging

All tool calls are logged to `.dexter/scratchpad/<timestamp>.jsonl` for debugging:

```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL"},"result":{...},"llmSummary":"Retrieved 5 years of Apple data..."}
```

Each entry shows the tool name, arguments, raw results, and LLM interpretation.

### Configuration

Optional environment variables for advanced features:

```bash
# AI Providers (choose one or more)
ANTHROPIC_API_KEY=sk-...        # Claude models
GOOGLE_API_KEY=...              # Gemini models
XAI_API_KEY=...                 # Grok models
OPENROUTER_API_KEY=...          # OpenRouter
OLLAMA_BASE_URL=http://...      # Local Ollama

# Web Search (optional)
EXASEARCH_API_KEY=...           # Exa search (preferred)
TAVILY_API_KEY=...              # Tavily search (fallback)

# Evaluation
LANGSMITH_API_KEY=...           # For eval tracking
```

## Contributing

Contributions are welcome! Please keep PRs small and focused.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Documentation

- [CLAUDE.md](CLAUDE.md) - Complete architecture and developer guide
- [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md) - Brazil market feature coverage

## License

MIT License - see LICENSE file for details.
