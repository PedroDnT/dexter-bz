import { describe, it, expect } from 'bun:test';
import {
  getCurrentDate,
  buildIterationPrompt,
  buildFinalAnswerPrompt,
  buildToolSummaryPrompt,
  buildContextSelectionPrompt,
} from '../agent/prompts.js';

describe('getCurrentDate', () => {
  it('returns a formatted date string', () => {
    const date = getCurrentDate();
    expect(typeof date).toBe('string');
    expect(date.length).toBeGreaterThan(0);
    // Should contain a year
    expect(date).toMatch(/\d{4}/);
  });

  it('contains day of week', () => {
    const date = getCurrentDate();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    expect(days.some((d) => date.includes(d))).toBe(true);
  });

  it('contains month name', () => {
    const date = getCurrentDate();
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    expect(months.some((m) => date.includes(m))).toBe(true);
  });
});

describe('buildIterationPrompt', () => {
  it('includes the original query', () => {
    const prompt = buildIterationPrompt('What is AAPL revenue?', [], null);
    expect(prompt).toContain('What is AAPL revenue?');
  });

  it('includes tool summaries', () => {
    const summaries = ['get_income_statements(AAPL) -> Revenue: $416B', 'get_prices(AAPL) -> Price: $200'];
    const prompt = buildIterationPrompt('AAPL analysis', summaries, null);
    expect(prompt).toContain('Revenue: $416B');
    expect(prompt).toContain('Price: $200');
  });

  it('includes tool usage status when provided', () => {
    const status = '## Tool Usage\n- get_prices: 2/3 calls';
    const prompt = buildIterationPrompt('test', [], status);
    expect(prompt).toContain('get_prices: 2/3 calls');
  });

  it('omits tool usage status when null', () => {
    const prompt = buildIterationPrompt('test', [], null);
    expect(prompt).not.toContain('Tool Usage');
  });

  it('includes instruction to respond directly if sufficient data', () => {
    const prompt = buildIterationPrompt('test', [], null);
    expect(prompt).toContain('respond directly WITHOUT calling any tools');
  });
});

describe('buildFinalAnswerPrompt', () => {
  it('includes query and context data', () => {
    const prompt = buildFinalAnswerPrompt('Compare AAPL and MSFT', 'AAPL revenue: 416B, MSFT revenue: 245B');
    expect(prompt).toContain('Compare AAPL and MSFT');
    expect(prompt).toContain('AAPL revenue: 416B');
    expect(prompt).toContain('MSFT revenue: 245B');
  });

  it('instructs not to ask user for data', () => {
    const prompt = buildFinalAnswerPrompt('test', 'data');
    expect(prompt).toContain('Do not ask the user to provide additional data');
  });
});

describe('buildToolSummaryPrompt', () => {
  it('formats tool name and args', () => {
    const prompt = buildToolSummaryPrompt(
      'AAPL revenue',
      'get_income_statements',
      { ticker: 'AAPL', period: 'annual' },
      '{"revenue": 416000000000}'
    );
    expect(prompt).toContain('get_income_statements');
    expect(prompt).toContain('ticker=AAPL');
    expect(prompt).toContain('period=annual');
  });

  it('includes the result data', () => {
    const prompt = buildToolSummaryPrompt('test', 'tool', {}, 'result data here');
    expect(prompt).toContain('result data here');
  });

  it('includes summary format instruction', () => {
    const prompt = buildToolSummaryPrompt('test', 'tool', {}, 'data');
    expect(prompt).toContain('[tool_call] -> [what was learned]');
  });
});

describe('buildContextSelectionPrompt', () => {
  it('formats summaries with indices and token costs', () => {
    const summaries = [
      { index: 0, toolName: 'get_prices', summary: 'AAPL price data', tokenCost: 15000 },
      { index: 1, toolName: 'get_income_statements', summary: 'AAPL income', tokenCost: 45000 },
    ];
    const prompt = buildContextSelectionPrompt('AAPL analysis', summaries);
    expect(prompt).toContain('[0] get_prices (~15k tokens): AAPL price data');
    expect(prompt).toContain('[1] get_income_statements (~45k tokens): AAPL income');
  });

  it('includes the query', () => {
    const prompt = buildContextSelectionPrompt('test query', []);
    expect(prompt).toContain('test query');
  });

  it('asks for JSON array of indices', () => {
    const prompt = buildContextSelectionPrompt('test', []);
    expect(prompt).toContain('JSON array of indices');
  });

  it('rounds token costs to nearest k', () => {
    const summaries = [
      { index: 0, toolName: 'tool', summary: 's', tokenCost: 1500 },
    ];
    const prompt = buildContextSelectionPrompt('q', summaries);
    expect(prompt).toContain('~2k tokens');
  });
});
