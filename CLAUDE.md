# CLAUDE.md

This file provides context for Claude Code when working on this repository.

## Project Overview

Dexter is an autonomous financial research agent built in TypeScript. It performs deep financial analysis using task planning, self-reflection, and real-time market data. It supports US and Brazilian (B3) markets.

## Tech Stack

- **Runtime**: Bun (v1.0+)
- **Language**: TypeScript (strict mode, ESNext target)
- **UI**: React 19 + Ink (terminal UI)
- **AI Orchestration**: LangChain with multi-provider support (OpenAI, Anthropic, Google, Ollama, xAI, OpenRouter)
- **Schema Validation**: Zod
- **Financial Data**: Financial Datasets API, BRAPI (Brazil), yfinance (Python helper)

## Common Commands

```bash
bun install              # Install dependencies
bun start                # Run interactive CLI
bun dev                  # Run in watch mode (development)
bun run typecheck        # Type-check with tsc --noEmit
bun test                 # Run tests
bun test --watch         # Run tests in watch mode
bun run investigate      # Run fraud/anomaly screening pipeline
```

## Project Structure

```
src/
  agent/        # Core agent loop, prompts, scratchpad, types
  components/   # React/Ink terminal UI components
  tools/        # Tool registry + implementations
    finance/    # ~17 financial data tools (fundamentals, prices, filings, etc.)
    search/     # Web search tools (Exa, Tavily)
  skills/       # Specialist workflows with SKILL.md guides
    dcf/        # DCF valuation skill
    brazil-market/  # Brazil/B3 market skill
  model/        # LLM provider configuration
  hooks/        # React hooks for agent UI
  utils/        # Utility modules (env, tokens, logging, chat history)
  evals/        # Evaluation framework (LangSmith + LLM-as-judge)
  pipelines/    # Data pipelines (fraud screening)
  __tests__/    # Test files
scripts/
  yfinance/     # Python helper for Yahoo Finance data
investigations/
  targets.json  # Fraud screening targets
```

## Testing

- Tests live in `src/__tests__/` and use Jest with `ts-jest` (ESM preset).
- Run with `bun test`. CI runs both `typecheck` and `test`.
- Test files follow the pattern `*.test.ts`.

## CI

GitHub Actions runs on push/PR to `main`:
1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun test`

## Code Conventions

- ESNext modules (`"type": "module"` in package.json)
- Path alias: `@/*` maps to `./src/*`
- JSX uses `react-jsx` transform (no React import needed)
- No linter or formatter is configured; rely on TypeScript strict mode for type safety
- Keep PRs small and focused

## Environment Variables

Required API keys are configured in `.env` (see `env.example`):
- `OPENAI_API_KEY` and `FINANCIAL_DATASETS_API_KEY` are required at minimum
- Brazil features need `BRAPI_TOKEN` and Python with `yfinance` installed
- Web search needs `EXASEARCH_API_KEY` or `TAVILY_API_KEY`
- Never commit `.env` or secrets
