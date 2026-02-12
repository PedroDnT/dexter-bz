---
name: run-tests
description: Run tests related to current changes
disable-model-invocation: true
---

# Run Tests

Run bun tests for the current changes.

## Usage

- **All tests**: Run `bun test`
- **Specific file**: Run `bun test <file-pattern>`
- **Watch mode**: Run `bun test --watch`

## Test Location

Tests are in `src/__tests__/` and use bun:test (Jest-compatible API).

## Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test src/__tests__/cvm.test.ts

# Run tests matching pattern
bun test --filter "fraud"

# Watch mode
bun test --watch
```
