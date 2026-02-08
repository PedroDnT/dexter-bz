import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Scratchpad } from '../agent/scratchpad.js';
import { existsSync, rmSync, readFileSync } from 'fs';

const TEST_SCRATCHPAD_DIR = '.dexter/scratchpad';

describe('Scratchpad', () => {
  let scratchpad: Scratchpad;
  let filepath: string;

  beforeEach(() => {
    scratchpad = new Scratchpad('test query about Apple stock');
    // Find the created file
    const entries = readFileSync(getLatestFile(), 'utf-8');
    filepath = getLatestFile();
  });

  function getLatestFile(): string {
    // Scratchpad writes immediately, so we can find the file
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(TEST_SCRATCHPAD_DIR) as string[];
    const sorted = files
      .filter((f: string) => f.endsWith('.jsonl'))
      .sort()
      .reverse();
    return path.join(TEST_SCRATCHPAD_DIR, sorted[0]);
  }

  afterEach(() => {
    // Clean up test files
    if (filepath && existsSync(filepath)) {
      rmSync(filepath);
    }
  });

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  it('creates a JSONL file with init entry on construction', () => {
    const file = getLatestFile();
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n');
    const init = JSON.parse(lines[0]);
    expect(init.type).toBe('init');
    expect(init.content).toBe('test query about Apple stock');
    expect(init.timestamp).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Tool results
  // -------------------------------------------------------------------------

  it('records tool results with parsed JSON', () => {
    scratchpad.addToolResult(
      'get_prices',
      { ticker: 'AAPL' },
      '{"price": 200}',
      'Got AAPL price: $200'
    );
    const contexts = scratchpad.getFullContexts();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].toolName).toBe('get_prices');
    expect(contexts[0].args).toEqual({ ticker: 'AAPL' });
  });

  it('stores plain text results when JSON parsing fails', () => {
    scratchpad.addToolResult('web_search', { query: 'test' }, 'not valid json', 'Search results');
    const contexts = scratchpad.getFullContexts();
    expect(contexts[0].result).toBe('not valid json');
  });

  it('tracks tool summaries', () => {
    scratchpad.addToolResult('tool1', {}, '{}', 'Summary 1');
    scratchpad.addToolResult('tool2', {}, '{}', 'Summary 2');
    const summaries = scratchpad.getToolSummaries();
    expect(summaries).toEqual(['Summary 1', 'Summary 2']);
  });

  it('provides tool call records', () => {
    scratchpad.addToolResult('get_prices', { ticker: 'AAPL' }, '{"price": 200}', 'Got price');
    const records = scratchpad.getToolCallRecords();
    expect(records).toHaveLength(1);
    expect(records[0].tool).toBe('get_prices');
    expect(records[0].args).toEqual({ ticker: 'AAPL' });
  });

  it('hasToolResults returns false initially, true after adding', () => {
    const fresh = new Scratchpad('fresh query');
    expect(fresh.hasToolResults()).toBe(false);
    fresh.addToolResult('test', {}, '{}', 'summary');
    expect(fresh.hasToolResults()).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Thinking
  // -------------------------------------------------------------------------

  it('records thinking entries', () => {
    scratchpad.addThinking('I should look up AAPL financials');
    const file = getLatestFile();
    const content = readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n');
    const thinking = JSON.parse(lines[lines.length - 1]);
    expect(thinking.type).toBe('thinking');
    expect(thinking.content).toBe('I should look up AAPL financials');
  });

  // -------------------------------------------------------------------------
  // Context with summaries
  // -------------------------------------------------------------------------

  it('provides contexts with summaries and indices', () => {
    scratchpad.addToolResult('tool1', { a: 1 }, '{"data": 1}', 'Summary A');
    scratchpad.addToolResult('tool2', { b: 2 }, '{"data": 2}', 'Summary B');
    const ctxs = scratchpad.getFullContextsWithSummaries();
    expect(ctxs).toHaveLength(2);
    expect(ctxs[0].index).toBe(0);
    expect(ctxs[0].llmSummary).toBe('Summary A');
    expect(ctxs[1].index).toBe(1);
    expect(ctxs[1].llmSummary).toBe('Summary B');
  });

  // -------------------------------------------------------------------------
  // Skill deduplication
  // -------------------------------------------------------------------------

  it('tracks executed skills for deduplication', () => {
    expect(scratchpad.hasExecutedSkill('dcf')).toBe(false);
    scratchpad.addToolResult('skill', { skill: 'dcf' }, 'Skill instructions...', 'DCF skill loaded');
    expect(scratchpad.hasExecutedSkill('dcf')).toBe(true);
    expect(scratchpad.hasExecutedSkill('brazil-market')).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Tool limits
  // -------------------------------------------------------------------------

  it('allows tool calls when under limit', () => {
    const status = scratchpad.canCallTool('get_prices');
    expect(status.allowed).toBe(true);
    expect(status.warning).toBeUndefined();
  });

  it('warns when approaching limit (1 call remaining)', () => {
    scratchpad.recordToolCall('get_prices', 'AAPL');
    scratchpad.recordToolCall('get_prices', 'MSFT');
    const status = scratchpad.canCallTool('get_prices', 'GOOGL');
    expect(status.allowed).toBe(true);
    expect(status.warning).toContain('approaching the suggested limit');
  });

  it('warns when over limit but still allows', () => {
    scratchpad.recordToolCall('get_prices', 'AAPL');
    scratchpad.recordToolCall('get_prices', 'MSFT');
    scratchpad.recordToolCall('get_prices', 'GOOGL');
    const status = scratchpad.canCallTool('get_prices');
    expect(status.allowed).toBe(true);
    expect(status.warning).toContain('has been called 3 times');
  });

  it('warns on similar query detection', () => {
    scratchpad.recordToolCall('get_prices', 'apple stock price');
    const status = scratchpad.canCallTool('get_prices', 'apple stock price today');
    expect(status.allowed).toBe(true);
    // The queries share most words, should trigger similarity warning
    expect(status.warning).toContain('similar to a previous');
  });

  // -------------------------------------------------------------------------
  // Tool usage status
  // -------------------------------------------------------------------------

  it('returns empty status when no tools called', () => {
    const statuses = scratchpad.getToolUsageStatus();
    expect(statuses).toHaveLength(0);
  });

  it('tracks tool usage across multiple tools', () => {
    scratchpad.recordToolCall('get_prices', 'AAPL');
    scratchpad.recordToolCall('get_income_statements', 'AAPL');
    scratchpad.recordToolCall('get_prices', 'MSFT');
    const statuses = scratchpad.getToolUsageStatus();
    expect(statuses).toHaveLength(2);
    const priceStatus = statuses.find((s) => s.toolName === 'get_prices');
    expect(priceStatus!.callCount).toBe(2);
    expect(priceStatus!.remainingCalls).toBe(1);
    expect(priceStatus!.isBlocked).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Format tool usage for prompt
  // -------------------------------------------------------------------------

  it('returns null when no tools used', () => {
    expect(scratchpad.formatToolUsageForPrompt()).toBeNull();
  });

  it('formats tool usage summary', () => {
    scratchpad.recordToolCall('get_prices');
    scratchpad.recordToolCall('get_prices');
    const formatted = scratchpad.formatToolUsageForPrompt();
    expect(formatted).toContain('get_prices');
    expect(formatted).toContain('2/3 calls');
  });

  it('shows over-limit status', () => {
    scratchpad.recordToolCall('get_prices');
    scratchpad.recordToolCall('get_prices');
    scratchpad.recordToolCall('get_prices');
    const formatted = scratchpad.formatToolUsageForPrompt();
    expect(formatted).toContain('over suggested limit');
  });

  // -------------------------------------------------------------------------
  // Custom limit config
  // -------------------------------------------------------------------------

  it('accepts custom limit configuration', () => {
    const customScratchpad = new Scratchpad('custom limits query', { maxCallsPerTool: 5 });
    customScratchpad.recordToolCall('get_prices');
    customScratchpad.recordToolCall('get_prices');
    customScratchpad.recordToolCall('get_prices');
    const status = customScratchpad.canCallTool('get_prices');
    expect(status.warning).toBeUndefined(); // Under custom limit of 5
  });
});
