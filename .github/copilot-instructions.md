# Dexter - AI Financial Research Agent

## Project Overview

Dexter is an autonomous financial research agent built with TypeScript/Bun, React (Ink), and LangChain. It uses an agentic loop: decompose queries → plan → execute tools → self-validate → iterate. Think Claude Code, but for financial research.

## Architecture

### Agent Loop (`src/agent/agent.ts`)
- **Iterative execution**: Max 10 iterations per query (configurable)
- **Scratchpad**: Single source of truth for all work (`.dexter/scratchpad/*.jsonl`)
- **Context management**: Tool summaries during loop, full context for final answer
- **Tool limit**: Max 3 calls per tool per query with similarity checking to prevent loops

### Tool System (`src/tools/`)
- **Registry pattern** (`registry.ts`): Conditionally loads tools based on env config
- **Rich descriptions** (`descriptions/`): Each tool has "when to use", "when NOT to use", usage notes
- **Meta-tools**: `financial_search` and `financial_metrics` are intelligent routers, not simple APIs
- **Tool composition**: Tools call other tools internally (see `src/tools/finance/`)

### Skills System (`src/skills/`)
- **SKILL.md format**: YAML frontmatter (name, description) + Markdown instructions
- **Discovery order**: builtin → `~/.dexter/skills` → `.dexter/skills` (later overrides)
- **Composable workflows**: Skills are reusable instruction templates (e.g., `dcf/SKILL.md`, `brazil-market/SKILL.md`)
- **Auto-injection**: Skills available via `skill` tool when present

### Brazil Market Support (`BRAZIL_FEATURES.md`)
- **Data sources**: BRAPI (B3 prices/fundamentals), yfinance (via Python bridge), CVM (filings), PTAX (FX rates)
- **Dual currency**: Brazil outputs include both BRL and USD using latest PTAX
- **Ticker patterns**: Recognizes `.SA` suffix and raw B3 tickers (PETR4, VALE3, ITUB4)
- **Known gaps**: Documented in `BRAZIL_FEATURES.md` (insider trades, segmented revenue, historical ratios)

### Investigation Pipeline (`src/pipelines/fraud/`)
**Purpose**: Deterministic red-flag screening over public-market data (prices, fundamentals, filings).

**Run commands**:
```bash
bun run investigate --open              # All targets + open reports
bun run investigate --target AAPL        # Single ticker
bun run investigate --targets AAPL,MSFT  # Multiple tickers
bun run investigate --config custom.json # Custom config
bun run investigate --no-setup           # Skip setup phase
```

**Anomaly Detection Thresholds** (`src/pipelines/fraud/anomalies.ts`):

1. **Earnings Quality**:
   - CFO to Net Income < 0.6 → Medium flag
   - Positive earnings + negative CFO → High flag

2. **Accrual Ratio** `(NI - CFO) / Total Assets`:
   - \> 0.1 → Medium flag
   - \> 0.2 → High flag

3. **Receivables vs Revenue Growth**:
   - Receivables growth exceeds revenue by > 0.25 → Medium flag
   - Receivables growth exceeds revenue by > 0.5 → High flag

4. **Balance Sheet Identity** `|Assets - (Liabilities + Equity)| / Assets`:
   - \> 2% → Low flag
   - \> 5% → Medium flag

5. **Revenue Swing** (YoY):
   - \> 30% → Low flag
   - \> 60% → Medium flag

6. **Data Coverage**:
   - Missing 1-2 inputs → Low flag
   - Missing 3+ inputs → Medium flag

**Targets config**: `investigations/targets.json` (supports both ticker and company name queries)

**Output structure**:
- Per-target: `.dexter/reports/<run-id>/<target>/report.html`
- Run index: `.dexter/reports/<run-id>/index.html`
- Latest shortcut: `.dexter/reports/latest/` (symlink)

**Computed Metrics** (stored in `FraudMetrics`):
- `revenue`, `net_income`, `net_cash_flow_from_operations`, `free_cash_flow`
- `revenue_yoy_growth`, `net_income_yoy_growth`, `cfo_yoy_growth`, `fcf_yoy_growth`
- `cfo_to_net_income` (earnings quality ratio)
- `accrual_ratio` = `(NI - CFO) / Total Assets`
- `receivables_yoy_growth`, `receivables_minus_revenue_growth`
- `balance_sheet_identity_diff`, `balance_sheet_identity_rel`
- `filings_count`, `missing_inputs` (data coverage metadata)

**Disclaimer**: Outputs are heuristic anomaly screening, not proof of fraud. Require verification using primary filings.

## Key Workflows

### Development
```bash
bun start                      # Interactive mode
bun dev                        # Watch mode
bun run investigate            # Run fraud pipeline (all targets)
bun run investigate --open     # Run pipeline + open reports in browser
bun run typecheck              # TypeScript checks
bun test                       # Run test suite
bun test --watch               # Watch mode for tests
```

### Evaluation Suite (`src/evals/`)
```bash
bun run src/evals/run.ts           # Run on all questions
bun run src/evals/run.ts --sample 10  # Random sample of 10
```

- **Dataset**: `src/evals/dataset/finance_agent.csv` (question, expected_answer pairs)
- **LLM-as-Judge**: GPT-5.2 evaluates correctness (binary score: 0 or 1)
- **Tracking**: All runs logged to LangSmith with experiment names (`dexter-eval-<timestamp>`)
- **UI**: Real-time Ink-based progress display with running accuracy
- **Adding cases**: Append to CSV, parser handles multi-line quoted fields

### Environment Setup
Required keys: `OPENAI_API_KEY`, `FINANCIAL_DATASETS_API_KEY`

Optional providers: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`

Optional features: `EXASEARCH_API_KEY` (or `TAVILY_API_KEY`), `LANGSMITH_API_KEY` (for evals)

For Brazil: `BRAPI_TOKEN`, Python with `yfinance` installed, optional `YFINANCE_PYTHON_BIN`

### Model Selection (`src/model/llm.ts`)
**Provider detection by prefix**:
- `claude-*` → Anthropic (e.g., `claude-haiku-4-5`, `claude-opus-4-2`)
- `gemini-*` → Google (e.g., `gemini-3-flash-preview`)
- `grok-*` → xAI (e.g., `grok-4-1-fast-reasoning`)
- `openrouter:*` → OpenRouter (e.g., `openrouter:openai/gpt-4o`)
- `ollama:*` → Ollama (e.g., `ollama:llama2`, uses `OLLAMA_BASE_URL` if set)
- Default → OpenAI (e.g., `gpt-5.2`, `gpt-4.1`)

**Fast model variants** (used for summaries, tool routing):
- OpenAI: `gpt-4.1`
- Anthropic: `claude-haiku-4-5`
- Google: `gemini-3-flash-preview`
- xAI: `grok-4-1-fast-reasoning`
- Ollama: Falls back to specified model

**Strategy**: Use flagship models for agent loop, fast models for tool summaries and context compression.

### Debugging
- **Scratchpad logs**: `.dexter/scratchpad/<timestamp>_<hash>.jsonl`
- **Entry types**: `init` (query), `tool_result` (args + raw result + LLM summary), `thinking` (reasoning)
- **Purpose**: Inspect exactly what data was gathered and how the agent interpreted it
- **Tool limits**: Max 3 calls per tool per query enforced in `Scratchpad.checkToolLimit()`

## Code Conventions

### Tool Development
1. Create tool in `src/tools/finance/` or `src/tools/search/`
2. Add rich description in `src/tools/descriptions/` with "when to use" + "when NOT to use"
3. Register in `getToolRegistry()` with conditional loading based on env
4. For meta-tools: route to underlying tools, don't duplicate logic

### Skill Development
1. Create directory in `src/skills/<skill-name>/`
2. Add `SKILL.md` with YAML frontmatter (`name`, `description`) + step-by-step instructions
3. Include concrete examples with tool query templates
4. Reference supporting files (e.g., `sector-wacc.md` in dcf skill)

### Brazil Data Handling
- Always check for `_usd` suffix fields (e.g., `market_cap_usd`, `price_usd`)
- Include PTAX metadata in outputs: `{ ptax_rate, ptax_date, ptax_source }`
- Fall back gracefully when BRAPI/yfinance unavailable
- Document gaps in `BRAZIL_FEATURES.md` using `recordBrazilGap()` helper

### System Prompts (`src/agent/prompts.ts`)
- Built from: `DEFAULT_SYSTEM_PROMPT` + tool descriptions + skill metadata
- Inject tool descriptions via `buildToolDescriptions(model)`
- Inject skill metadata via `buildSkillMetadataSection()`
- Keep prompts token-efficient: summaries during loop, full data for final answer

### Testing Patterns
- Use Jest (`jest.config.js`, `src/__tests__/`)
- Mock external APIs (Financial Datasets, BRAPI, yfinance)
- Test tool routing logic separately from API calls
- Validate scratchpad JSONL append operations

## Critical Files

- `src/index.tsx`: CLI entry point (Ink-based UI)
- `src/agent/agent.ts`: Core agentic loop and iteration logic
- `src/agent/scratchpad.ts`: Persistent work tracking and tool limits
- `src/tools/registry.ts`: Tool registration and conditional loading
- `src/skills/registry.ts`: Skill discovery and caching
- `src/pipelines/run-all.ts`: Investigation pipeline orchestrator
- `src/tools/finance/brazil-features.ts`: Gap tracking for Brazil features

## Common Pitfalls

1. **Don't call meta-tools multiple times**: `financial_search` handles complexity internally—pass the full query once
2. **Respect tool limits**: Agent strictly enforces max 3 calls per tool per query (no overrides)
3. **Check scratchpad before debugging**: All tool calls are logged as JSONL, inspect before assuming issues
4. **Brazil ticker resolution**: Both `PETR4` and `PETR4.SA` work, but outputs differ (BRAPI vs yfinance)
5. **Skills aren't code**: They're instructions that guide the agent's tool usage—don't treat them as functions
6. **PTAX is latest, not period-end**: USD conversions use current PTAX, not historical rates from statement dates
7. **Model selection in config**: Default is `gpt-5.2`, but always check `AgentConfig.model` for runtime overrides
8. **Investigation thresholds are hard-coded**: Don't assume they're configurable—edit `anomalies.ts` directly to tune

## Extension Points

- **New data sources**: Add provider in `src/tools/finance/providers/`, integrate in meta-tools
- **New anomaly checks**: Add detection logic in `computeFraudSignals()` (`src/pipelines/fraud/anomalies.ts`)
- **Custom thresholds**: Edit constants in `anomalies.ts` (e.g., change accrual threshold from 0.1 to 0.15)
- **Custom skills**: Drop `SKILL.md` in `.dexter/skills/<name>/` (project-level override)
- **UI components**: React components in `src/components/` for Ink rendering
- **Eval dataset**: Add questions to `src/evals/dataset/finance_agent.csv` (use quoted strings for multi-line)
- **New model providers**: Add factory in `MODEL_PROVIDERS` map (`src/model/llm.ts`)
