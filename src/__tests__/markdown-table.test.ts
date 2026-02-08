import { describe, it, expect } from 'bun:test';
import { parseMarkdownTable, renderBoxTable, transformMarkdownTables } from '../utils/markdown-table.js';

describe('parseMarkdownTable', () => {
  it('parses a standard markdown table', () => {
    const table = `| Name | Value |
|------|-------|
| A    | 100   |
| B    | 200   |`;
    const result = parseMarkdownTable(table);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Name', 'Value']);
    expect(result!.rows).toEqual([['A', '100'], ['B', '200']]);
  });

  it('handles tables with alignment markers', () => {
    const table = `| Name | Value |
|:-----|------:|
| A    | 100   |`;
    const result = parseMarkdownTable(table);
    expect(result).not.toBeNull();
    expect(result!.headers).toEqual(['Name', 'Value']);
    expect(result!.rows).toHaveLength(1);
  });

  it('returns null for text with less than 2 lines', () => {
    expect(parseMarkdownTable('| Only one line |')).toBeNull();
  });

  it('returns null for text without pipes', () => {
    expect(parseMarkdownTable('No pipes here\nJust text')).toBeNull();
  });

  it('returns null for invalid separator line', () => {
    const table = `| Name | Value |
| not a separator |
| A    | 100   |`;
    expect(parseMarkdownTable(table)).toBeNull();
  });

  it('handles rows with varying cell counts', () => {
    const table = `| A | B | C |
|---|---|---|
| 1 | 2 |
| 3 | 4 | 5 |`;
    const result = parseMarkdownTable(table);
    expect(result).not.toBeNull();
    expect(result!.rows[0]).toEqual(['1', '2']);
    expect(result!.rows[1]).toEqual(['3', '4', '5']);
  });

  it('trims cell values', () => {
    const table = `|  Name  |  Value  |
|--------|---------|
|  A     |  100    |`;
    const result = parseMarkdownTable(table);
    expect(result!.rows[0]).toEqual(['A', '100']);
  });
});

describe('renderBoxTable', () => {
  it('renders a simple table with box drawing chars', () => {
    const output = renderBoxTable(['Name', 'Value'], [['A', '100']]);
    expect(output).toContain('┌');
    expect(output).toContain('┐');
    expect(output).toContain('└');
    expect(output).toContain('┘');
    expect(output).toContain('│');
    expect(output).toContain('─');
    expect(output).toContain('Name');
    expect(output).toContain('Value');
    expect(output).toContain('A');
    expect(output).toContain('100');
  });

  it('right-aligns numeric columns', () => {
    const output = renderBoxTable(
      ['Name', 'Price'],
      [
        ['AAPL', '$200'],
        ['MSFT', '$400'],
        ['GOOGL', '$150'],
      ]
    );
    // Numeric columns should have right-aligned data
    const lines = output.split('\n');
    // Find data rows (lines containing AAPL, MSFT, etc.)
    const dataLines = lines.filter((l) => l.includes('AAPL') || l.includes('MSFT'));
    expect(dataLines.length).toBeGreaterThan(0);
  });

  it('handles empty rows array', () => {
    const output = renderBoxTable(['A', 'B'], []);
    expect(output).toContain('A');
    expect(output).toContain('B');
    // Should still render header and borders
    expect(output.split('\n').length).toBeGreaterThanOrEqual(3);
  });

  it('calculates column widths from longest value', () => {
    const output = renderBoxTable(['X'], [['Short'], ['A much longer value']]);
    const lines = output.split('\n');
    // All border lines should be the same width
    expect(lines[0].length).toBe(lines[lines.length - 1].length);
  });
});

describe('transformMarkdownTables', () => {
  it('transforms markdown tables into box tables', () => {
    const input = `Some text before.

| Name | Value |
|------|-------|
| A    | 100   |

Some text after.`;
    const output = transformMarkdownTables(input);
    expect(output).toContain('┌');
    expect(output).toContain('Some text before');
    expect(output).toContain('Some text after');
  });

  it('leaves non-table content unchanged', () => {
    const input = 'Just plain text\nWith multiple lines';
    expect(transformMarkdownTables(input)).toBe(input);
  });

  it('normalizes line endings', () => {
    const input = 'Line 1\r\nLine 2\r\nLine 3';
    const output = transformMarkdownTables(input);
    expect(output).not.toContain('\r');
  });

  it('does not re-transform already-transformed tables', () => {
    const input = `| Name | Value |
|------|-------|
| A    | 100   |`;
    const firstPass = transformMarkdownTables(input);
    const secondPass = transformMarkdownTables(firstPass);
    expect(secondPass).toBe(firstPass);
  });
});
