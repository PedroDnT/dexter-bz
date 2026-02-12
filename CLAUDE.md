# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install                          # Install dependencies
bun start                            # Interactive CLI
bun dev                              # Watch mode (auto-reload)
bun test                             # Run all tests
bun test src/__tests__/scratchpad    # Run single test file (prefix match)
bun test --watch                     # Test watch mode
bun run typecheck                    # TypeScript type checking
bun run investigate                  # Fraud screening pipeline (all targets)
bun run investigate --target AAPL    # Single ticker
bun run investigate --open           # All targets + open reports in browser
bun run src/evals/run.ts             # Run evaluation suite
bun run src/evals/run.ts --sample 10 # Eval on random sample
```

CI runs `typecheck` then `test` on push/PR to main.

## Architecture

**Tech Stack**: Bun + TypeScript + React (Ink) + LangChain

### Agent Loop (`src/agent/agent.ts`)

The core execution engine. `Agent.create(config)` initializes tools and prompts, then `agent.run(query)` is an async generator yielding events (`tool_start`, `tool_end`, `thinking`, `answer_start`, `done`).

**Flow**: Build prompt → call LLM with tools bound → execute tool calls in parallel → record results in scratchpad with LLM summaries → repeat (up to 10 iterations) → load full context from scratchpad → generate final answer.

**Context compaction strategy**: During the loop, only LLM-generated summaries of tool results are used in prompts. For the final answer, full tool results are loaded from the scratchpad. If total context exceeds 100k tokens, the LLM selects which results need full data vs summaries (`buildContextSelectionPrompt` in `prompts.ts`).

**Tool limits**: Max 3 calls per tool per query. Jaccard similarity (0.7 threshold) on query args prevents retry loops. Warnings are injected into prompts when limits are approached but execution isn't blocked.

### Scratchpad (`src/agent/scratchpad.ts`)

Append-only JSONL log at `.dexter/scratchpad/<timestamp>_<hash>.jsonl`. Single source of truth for all agent work. Entry types: `init` (query), `tool_result` (args + raw result + LLM summary), `thinking` (reasoning). Drives both context compaction during the loop and full context retrieval for the final answer.

### Tool System (`src/tools/`)

**Registry** (`registry.ts`): Conditionally loads tools based on environment variables. Each tool has a rich markdown description in `src/tools/descriptions/` with "when to use" / "when NOT to use" guidance.

**Meta-tools** (`financial_search`, `financial_metrics`): These are intelligent routers, not simple APIs. They take a natural language query, call a fast LLM to select which underlying finance tools to invoke, execute them in parallel via `Promise.all()`, and merge results. `financial_search` routes to 15+ tools (prices, filings, news, etc.); `financial_metrics` is scoped to 6 fundamentals/ratios tools.

**Finance tools** (`src/tools/finance/`): Structured tools with Zod schemas for prices, fundamentals, filings, key ratios, analyst estimates, insider trades, segmented revenues, company facts, and crypto data.

### Skills System (`src/skills/`)

SKILL.md files (YAML frontmatter with `name` + `description`, then Markdown instructions) provide reusable workflow templates. Discovery order: builtin (`src/skills/`) → user (`~/.dexter/skills/`) → project (`.dexter/skills/`), with later entries overriding by name. Available skills: `dcf` (DCF valuation), `brazil-market` (B3 research patterns). The `skill` tool loads instructions at runtime; scratchpad deduplication prevents re-execution.

### Model Selection (`src/model/llm.ts`)

Provider auto-detected by model name prefix: `claude-*` → Anthropic, `gemini-*` → Google, `grok-*` → xAI, `openrouter:*` → OpenRouter, `ollama:*` → Ollama, default → OpenAI. Default model: `gpt-5.2`. Fast model variants (for summaries/routing): `gpt-4.1`, `claude-haiku-4-5`, `gemini-3-flash-preview`, `grok-4-1-fast-reasoning`. LLM calls have 3-attempt retry with exponential backoff.

### Fraud Pipeline (`src/pipelines/fraud/`)

Deterministic red-flag screening over public financial data. Orchestrated by `src/pipelines/run-all.ts`. Flow: resolve tickers → gather data → compute signals (`computeFraudSignals` in `anomalies.ts`) → render HTML reports. Outputs to `.dexter/reports/<run-id>/` with per-target reports and an index page (`.dexter/reports/latest/` symlink).

**Anomaly thresholds** (hard-coded in `anomalies.ts`):
- Earnings quality: CFO/NI < 0.6 → Medium; positive NI + negative CFO → High
- Accrual ratio (NI-CFO)/Assets: > 0.1 → Medium; > 0.2 → High
- Receivables vs revenue growth delta: > 0.25 → Medium; > 0.5 → High
- Balance sheet identity deviation: > 2% → Low; > 5% → Medium
- Revenue swing YoY: > 30% → Low; > 60% → Medium
- Missing data inputs: 1-2 → Low; 3+ → Medium

### CLI & UI (`src/index.tsx`, `src/cli.tsx`)

React + Ink terminal UI. Components in `src/components/`. Hooks: `useModelSelection` (provider/model flow), `useAgentRunner` (agent execution + events), `useInputHistory` (arrow key navigation).

## Brazil Market Support

Data sources: BRAPI (`BRAPI_TOKEN`), yfinance (Python bridge via `YFINANCE_PYTHON_BIN`), CVM (filings), PTAX (BCB FX rates). Both `PETR4` and `PETR4.SA` ticker formats work. All outputs include `_usd` suffix fields + `{ ptax_rate, ptax_date, ptax_source }` metadata. PTAX uses **latest** rate, not historical period-end. Known gaps documented in `BRAZIL_FEATURES.md`; track new gaps with `recordBrazilGap()`.

## Environment

**Required**: `OPENAI_API_KEY`, `FINANCIAL_DATASETS_API_KEY`

**Optional**: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `XAI_API_KEY`, `OPENROUTER_API_KEY`, `OLLAMA_BASE_URL`, `EXASEARCH_API_KEY` (or `TAVILY_API_KEY`), `LANGSMITH_API_KEY`, `BRAPI_TOKEN`, `YFINANCE_PYTHON_BIN`

## Code Conventions

- ESM only (`"type": "module"`), path alias `@/*` → `./src/*`
- JSX transform: `react-jsx` (no React import needed)
- TypeScript strict mode, no linter/formatter configured
- Tests use Bun's runner (`import { describe, it, expect } from 'bun:test'`), NOT Jest
- Mock external APIs in tests; test routing logic separately from API calls

## Common Pitfalls

1. **Meta-tools are one-shot**: `financial_search` handles complexity internally — pass the full query once, don't call repeatedly
2. **Tool limits enforced**: 3 calls per tool per query, with similarity detection on args
3. **Skills are instructions, not functions**: They return markdown guidance for the agent, not computed results
4. **PTAX is current, not historical**: USD conversions use latest rate, not statement-period rates
5. **Thresholds are hard-coded**: Edit `anomalies.ts` directly to change fraud detection thresholds
6. **Tests are Bun, not Jest**: Use `bun:test` imports; `@types/jest` is a devDep for legacy reasons only

## Extension Points

- **New tools**: Create in `src/tools/finance/` or `src/tools/search/`, add description in `src/tools/descriptions/`, register in `getToolRegistry()`
- **New skills**: Add `SKILL.md` in `src/skills/<name>/` (builtin) or `.dexter/skills/<name>/` (project override)
- **New anomaly checks**: Edit `computeFraudSignals()` in `src/pipelines/fraud/anomalies.ts`
- **New model providers**: Add factory to `MODEL_PROVIDERS` in `src/model/llm.ts`
- **New eval questions**: Append to `src/evals/dataset/finance_agent.csv`

## Critical Files

- `src/index.tsx` — CLI entry point (Ink UI)
- `src/agent/agent.ts` — Core agent loop and iteration logic
- `src/agent/scratchpad.ts` — Work tracking, tool limits, context retrieval
- `src/agent/prompts.ts` — System prompt composition (base + tool descriptions + skills)
- `src/tools/registry.ts` — Tool registration and conditional loading
- `src/tools/finance/financial-search.ts` — Meta-tool routing to 15+ finance tools
- `src/skills/registry.ts` — Skill discovery and caching
- `src/model/llm.ts` — LLM provider factory and fast model variants
- `src/pipelines/run-all.ts` — Investigation pipeline orchestrator
- `src/pipelines/fraud/anomalies.ts` — Anomaly detection logic and thresholds
