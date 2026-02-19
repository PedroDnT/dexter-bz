# Dead Code Analysis Report
Generated: 2026-02-12

## Executive Summary

Analysis found **70+ unused exports**, **11 unused files**, and **10 unused dependencies**.

### Quick Stats
- **Unused Files**: 11 (mostly evals components)
- **Unused Dependencies**: 10 dev dependencies + 1 runtime dependency
- **Unused Exports**: 70+ across 30+ files
- **Missing Dependencies**: 2 (`chalk`, but actually available via Ink)

---

## 🟢 SAFE TO DELETE

These items can be safely removed without breaking functionality:

### Unused Dev Dependencies (High Confidence)

```json
"devDependencies": {
  "@babel/core": "^7.29.0",           // ❌ Not used (Bun handles transpilation)
  "@babel/preset-env": "^7.29.0",     // ❌ Not used (Bun handles transpilation)
  "@types/jest": "^29.5.14",          // ❌ Not used (using bun:test, not Jest)
  "babel-jest": "^30.2.0",            // ❌ Not used (Bun test runner)
  "jest": "^29.7.0",                  // ❌ Not used (Bun test runner)
  "ts-jest": "^29.4.6",               // ❌ Not used (Bun test runner)
  "@types/iconv-lite": "^0.0.1",      // ✓ USED in src/tools/finance/providers/cvm.ts
  "knip": "^5.83.1",                  // 🔧 Analysis tool (can remove after cleanup)
  "depcheck": "^1.4.7",               // 🔧 Analysis tool (can remove after cleanup)
  "ts-prune": "^0.10.3"               // 🔧 Analysis tool (can remove after cleanup)
}
```

**Savings**: ~6 Jest/Babel packages (project uses Bun for testing)

### Unused Runtime Dependencies

```json
"dependencies": {
  "ink-text-input": "^6.0.0",  // ❌ Not imported anywhere (unused)
  "langsmith": "^0.4.12"       // ✓ USED in src/evals/run.ts (evals are optional but used)
}
```

**Recommendation**: Remove `ink-text-input` if not planned for future use.

### Unused Evals Files (If evals not needed)

```
src/evals/run.ts                                  // Entry point for evals
src/evals/components/EvalCurrentQuestion.tsx      // UI component
src/evals/components/EvalRecentResults.tsx        // UI component
src/evals/components/EvalStats.tsx                // UI component
src/evals/components/EvalProgress.tsx             // UI component
src/evals/components/index.ts                     // Re-export file
src/evals/components/EvalApp.tsx                  // Main evals UI
```

**⚠️ NOTE**: These are NOT dead code - they're entry points for `bun run src/evals/run.ts`. Only remove if you want to delete the evaluation system entirely.

### Unused Utility Exports (Low Impact)

```typescript
// src/utils/markdown-table.ts
export function transformBold(...) // Line 213 - unused

// src/utils/thinking-verbs.ts
export const THINKING_VERBS // Line 1 - unused (but tiny const, keep?)

// src/pipelines/fraud/index.ts
export const DEFAULT_DISCLAIMER // Line 8 - unused externally (might be used internally)
```

---

## 🟡 CAUTION - Verify Before Deleting

These might be used indirectly or needed for future features:

### Potentially Unused Component Exports

```typescript
// src/components/index.ts - Re-export barrel file
export { Intro } from './Intro.js'                          // Unused externally
export { Input } from './Input.js'                          // Unused externally
export { CursorText } from './CursorText.js'                // Unused externally
export { AnswerBox } from './AnswerBox.js'                  // Unused externally
export { ProviderSelector, ModelSelector, PROVIDERS, ...}   // Unused externally
export { ApiKeyConfirm, ApiKeyInput } from './ApiKeyPrompt.js' // Unused externally
export { DebugPanel } from './DebugPanel.tsx'              // Unused externally
export { EventListView } from './HistoryItemView.tsx'      // Unused externally
export type { DisplayEvent } from './HistoryItemView.tsx'  // Unused externally
```

**Analysis**: These are imported directly from their source files in `src/index.tsx` and `src/cli.tsx`, not via the barrel file. The barrel file itself (`src/components/index.ts`) is unused.

**Recommendation**:
- ✅ **SAFE**: Remove `src/components/index.ts` (barrel file not used)
- ⚠️ **KEEP**: Keep the individual component files

### Potentially Unused Tool Exports

```typescript
// src/tools/finance/index.ts - Re-export barrel file
export { getAllFinancialStatements } from './fundamentals.js'
export { get10KFilingItems, get10QFilingItems, get8KFilingItems } from './filings.js'
export { getKeyRatios } from './key-ratios.js'
export { getNews } from './news.js'
export { getAnalystEstimates } from './estimates.js'
export { getSegmentedRevenues } from './segments.js'
export { getCryptoPriceSnapshot, getCryptoPrices, getCryptoTickers } from './crypto.js'
export { getInsiderTrades } from './insider_trades.js'
```

**Analysis**: Tools are registered directly in `src/tools/registry.ts` from their source files, not via this barrel file.

**Recommendation**:
- ✅ **SAFE**: Remove `src/tools/finance/index.ts` (barrel file not used)
- ⚠️ **KEEP**: Keep the individual tool files

### Unused Utility Barrel File

```typescript
// src/utils/index.ts - Giant re-export barrel file
export { loadConfig, saveConfig, getSetting, setSetting } from './config.js'
export { getApiKeyNameForProvider } from './env.js'
export { getProviderDisplayName } from './provider.js'
export { checkApiKeyExistsForProvider, saveApiKeyForProvider } from './env.js'
export { InMemoryChatHistory } from './in-memory-chat-history.js'
export { logger, LogEntry, LogLevel } from './logger.js'
export { extractTextContent, hasToolCalls } from './ai-message.js'
export { LongTermChatHistory, ConversationEntry } from './long-term-chat-history.js'
export { findPrevWordStart, findNextWordEnd, cursorHandlers, CursorContext } from './input-key-handlers.js'
export { getToolDescription } from './tool-descriptions.js'
export { transformMarkdownTables, formatResponse } from './markdown-table.js'
export { estimateTokens, TOKEN_BUDGET } from './tokens.js'
```

**Analysis**: This barrel file is unused - imports happen directly from source files.

**Recommendation**:
- ✅ **SAFE**: Remove `src/utils/index.ts` (barrel file not used)
- ⚠️ **KEEP**: Keep the individual utility files

### Unused Skills Exports

```typescript
// src/skills/index.ts - Skill loader utilities
export { clearSkillCache } from './loader.js'           // Unused
export { parseSkillFile } from './loader.js'            // Unused
export { loadSkillFromPath } from './loader.js'         // Unused
export { extractSkillMetadata } from './loader.js'      // Unused
export type { SkillMetadata, Skill, SkillSource } from './types.js' // Unused
```

**Analysis**: Skills are loaded via `src/skills/registry.ts`, not this barrel file.

**Recommendation**:
- ✅ **SAFE**: Remove `src/skills/index.ts` (barrel file not used)
- ⚠️ **KEEP**: Keep `src/skills/loader.ts` and `src/skills/registry.ts`

---

## 🔴 DANGER - Do NOT Delete

Critical infrastructure exports that appear unused but are actually used:

### Agent Infrastructure

```typescript
// src/agent/index.ts - Core agent exports
export { Agent } from './agent.js'                          // ✓ USED (main entry point)
export { Scratchpad } from './scratchpad.js'                // ⚠️ Might be used in tests
export { getCurrentDate, buildSystemPrompt, buildIterationPrompt, DEFAULT_SYSTEM_PROMPT } from './prompts.js' // ⚠️ Internal use
export type { Message, ThinkingEvent, ToolStartEvent, ToolEndEvent, ToolErrorEvent, ToolLimitEvent, AnswerStartEvent } // ⚠️ Type exports
export type { ToolCallRecord, ToolContext, ScratchpadEntry, ToolLimitConfig, ToolUsageStatus } // ⚠️ Type exports
```

**Keep all** - these are core agent types and might be used in tests or future extensions.

### Tool Registry

```typescript
// src/tools/registry.ts
export function getToolRegistry() // ✓ USED in src/agent/agent.ts
export type RegisteredTool        // ✓ USED for type safety
```

**Keep all** - core infrastructure.

### Model Factory

```typescript
// src/model/llm.ts
export function getChatModel() // ✓ USED in src/agent/agent.ts
```

**Keep** - core infrastructure.

---

## 📊 Missing Dependencies (False Positives)

These are flagged as "missing" but are actually available:

```json
"missing": {
  "chalk": [
    "src/components/CursorText.tsx",
    "src/utils/markdown-table.ts"
  ]
}
```

**Analysis**: `chalk` is a transitive dependency of `ink`. Available at runtime but not declared directly.

**Recommendation**: Either add `chalk` to dependencies explicitly OR refactor to use Ink's built-in styling.

---

## 🎯 Recommended Cleanup Actions

### Phase 1: Safe Deletions (No Tests Required)

1. **Remove Jest/Babel dependencies** (project uses Bun):
   ```bash
   bun remove -d @babel/core @babel/preset-env babel-jest jest ts-jest @types/jest
   ```

2. **Remove unused analysis tools** (after cleanup):
   ```bash
   bun remove -d knip depcheck ts-prune
   ```

3. **Remove unused runtime dependency**:
   ```bash
   bun remove ink-text-input
   ```

4. **Remove barrel files** (not used, just re-exports):
   ```bash
   rm src/components/index.ts
   rm src/tools/finance/index.ts
   rm src/utils/index.ts
   rm src/skills/index.ts
   rm src/tools/index.ts  # VERIFY FIRST - might be used
   ```

### Phase 2: Verify and Delete with Tests

1. **Remove unused utility exports**:
   - `src/utils/markdown-table.ts:213` - `transformBold` function
   - Verify no dynamic imports or eval usage
   - Run tests: `bun test`

2. **Add missing dependency** (if chalk is actually needed):
   ```bash
   bun add chalk
   ```
   OR refactor to use Ink's built-in styling.

### Phase 3: Consider Removing Evals (Optional)

If evaluation system is not actively used:
```bash
rm -rf src/evals/
```

**⚠️ WARNING**: This will delete the entire evaluation framework. Only do this if you're sure you don't need it.

---

## 📈 Expected Savings

| Category | Before | After | Savings |
|----------|--------|-------|---------|
| Dev Dependencies | 14 | 7 | 50% |
| Runtime Dependencies | 13 | 12 | 8% |
| Barrel Files | 5 | 0 | 100% |
| Unused Exports | 70+ | ~10 | 85% |

**Total node_modules size reduction**: ~50-100MB (Jest + Babel ecosystem)

---

## ✅ Verification Checklist

Before each deletion:
- [ ] Run `bun test` - all tests pass
- [ ] Run `bun run typecheck` - no type errors
- [ ] Run `bun start` - CLI starts successfully
- [ ] Run `x` - fraud pipeline works
- [ ] Git commit after each successful deletion

---

## 🔍 Next Steps

1. Review this report
2. Decide which items to remove (start with Phase 1)
3. Create a git branch for cleanup
4. Remove items one category at a time
5. Run full test suite after each change
6. Commit incrementally
7. Final verification before merge

