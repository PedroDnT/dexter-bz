# Developer Guide

Technical reference for contributors and AI coding assistants.

## Quick Reference

**Tech Stack**: Bun + TypeScript + React (Ink) + LangChain

**Commands**:
```bash
bun install              # Install dependencies
bun start                # Interactive CLI
bun dev                  # Watch mode
bun test                 # Run tests
bun test --watch         # Test watch mode
bun run typecheck        # Type check
bun run investigate      # Fraud screening pipeline
```

**Key Directories**:
- `src/agent/` - Core agent loop and scratchpad
- `src/tools/` - Financial and search tools
- `src/skills/` - Workflow templates (SKILL.md format)
- `src/evals/` - Evaluation framework
- `src/pipelines/` - Data pipelines (fraud screening)
- `src/__tests__/` - Test files

## Project Structure

```
src/
  agent/        # Core agent loop, prompts, scratchpad, types
  components/   # React/Ink terminal UI
  tools/        # Tool registry + implementations
    finance/    # Financial data tools
    search/     # Web search tools
  skills/       # SKILL.md workflow guides
  model/        # LLM provider config
  utils/        # Logging, env, tokens, chat history
  evals/        # LangSmith evaluation framework
  pipelines/    # Fraud screening pipeline
  __tests__/    # Bun test files
```

## Environment Setup

**Required**:
```bash
OPENAI_API_KEY=...
FINANCIAL_DATASETS_API_KEY=...
```

**Optional**:
```bash
# Additional LLM providers
ANTHROPIC_API_KEY=...
GOOGLE_API_KEY=...
XAI_API_KEY=...
OPENROUTER_API_KEY=...
OLLAMA_BASE_URL=http://127.0.0.1:11434

# Web search
EXASEARCH_API_KEY=...
TAVILY_API_KEY=...

# Brazil support
BRAPI_TOKEN=...
YFINANCE_PYTHON_BIN=python3

# Evaluation
LANGSMITH_API_KEY=...
```

## Code Conventions

- **Module System**: ESM only (`"type": "module"`)
- **Path Alias**: `@/*` → `./src/*`
- **JSX Transform**: `react-jsx` (no React import needed)
- **Testing**: Bun test runner (`bun:test` imports)
- **Type Safety**: TypeScript strict mode
- **No Formatter**: No linter/formatter configured

## Key Concepts

### Agent Loop
Max 10 iterations per query. Scratchpad logs all work to `.dexter/scratchpad/*.jsonl`. Tool limit: 3 calls per tool per query.

### Tool System
Registry-based with conditional loading. Each tool has rich descriptions in `src/tools/descriptions/` with "when to use" guidance.

### Skills System
SKILL.md files (YAML frontmatter + Markdown) provide reusable workflow templates. Discovery: builtin → `~/.dexter/skills` → `.dexter/skills`.

### Model Selection
Provider auto-detected by model name prefix:
- `claude-*` → Anthropic
- `gemini-*` → Google
- `grok-*` → xAI
- `openrouter:*` → OpenRouter
- `ollama:*` → Ollama
- Default → OpenAI

### Brazil Support
BRAPI + yfinance for B3 data. Dual currency output (BRL + USD). Latest PTAX rate for conversion. See [BRAZIL_FEATURES.md](BRAZIL_FEATURES.md).

### Fraud Pipeline
Automated anomaly detection over public data. Configurable via `investigations/targets.json`. Outputs HTML reports to `.dexter/reports/`.

## Testing

- Tests use Bun's built-in runner (`bun test`)
- Test files: `src/__tests__/*.test.ts`
- Import from `bun:test`, not Jest
- CI runs: `typecheck` → `test`

## Development Workflow

1. Run tests before changes: `bun test`
2. Make minimal changes
3. Run type check: `bun run typecheck`
4. Test your changes: `bun test`
5. Manual verification: `bun start` or `bun dev`

## Common Patterns

### Tool Development
1. Create in `src/tools/finance/` or `src/tools/search/`
2. Add description in `src/tools/descriptions/`
3. Register in `getToolRegistry()`
4. Mock external APIs in tests

### Skill Development
1. Create `src/skills/<name>/SKILL.md`
2. YAML frontmatter: `name`, `description`
3. Markdown: step-by-step instructions
4. Include concrete examples

### Testing Pattern
```typescript
import { describe, test, expect } from 'bun:test';

describe('feature', () => {
  test('behavior', () => {
    expect(result).toBe(expected);
  });
});
```

## Debugging

All agent activity logged to `.dexter/scratchpad/<timestamp>_<hash>.jsonl`:
- `init`: Original query
- `tool_result`: Tool call + args + result + LLM summary
- `thinking`: Agent reasoning

## Extension Points

- **New tools**: Add to `src/tools/finance/` or `src/tools/search/`
- **New skills**: Drop SKILL.md in `.dexter/skills/<name>/`
- **New anomaly checks**: Edit `src/pipelines/fraud/anomalies.ts`
- **New model providers**: Add to `MODEL_PROVIDERS` in `src/model/llm.ts`
- **New eval questions**: Append to `src/evals/dataset/finance_agent.csv`

## Critical Files

- `src/index.tsx` - CLI entry point
- `src/agent/agent.ts` - Core agent loop
- `src/agent/scratchpad.ts` - Work tracking
- `src/tools/registry.ts` - Tool registration
- `src/skills/registry.ts` - Skill discovery
- `src/pipelines/run-all.ts` - Investigation orchestrator

## Common Pitfalls

1. Don't call meta-tools repeatedly - they handle complexity internally
2. Tool limits are enforced (3 calls/tool/query)
3. Check scratchpad logs before debugging
4. Skills are instructions, not functions
5. PTAX rates are current, not historical
6. Investigation thresholds are hard-coded in `anomalies.ts`
7. Tests use Bun, not Jest (check imports)
