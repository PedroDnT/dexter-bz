import { describe, it, expect } from 'bun:test';
import { parseSkillFile } from '../skills/loader.js';

describe('parseSkillFile', () => {
  it('parses valid SKILL.md content with frontmatter', () => {
    const content = `---
name: dcf
description: Perform a DCF valuation analysis
---
## Steps
1. Gather financial data
2. Project future cash flows
3. Calculate terminal value`;
    const skill = parseSkillFile(content, '/path/to/SKILL.md', 'builtin');
    expect(skill.name).toBe('dcf');
    expect(skill.description).toBe('Perform a DCF valuation analysis');
    expect(skill.path).toBe('/path/to/SKILL.md');
    expect(skill.source).toBe('builtin');
    expect(skill.instructions).toContain('## Steps');
    expect(skill.instructions).toContain('Gather financial data');
  });

  it('trims instructions whitespace', () => {
    const content = `---
name: test
description: Test skill
---

  Some instructions with leading whitespace

`;
    const skill = parseSkillFile(content, '/path', 'user');
    expect(skill.instructions).not.toMatch(/^\s+/);
    expect(skill.instructions).not.toMatch(/\s+$/);
  });

  it('throws when name is missing', () => {
    const content = `---
description: Missing name
---
Instructions here`;
    expect(() => parseSkillFile(content, '/path/to/file.md', 'builtin')).toThrow(
      "missing required 'name' field"
    );
  });

  it('throws when description is missing', () => {
    const content = `---
name: test-skill
---
Instructions here`;
    expect(() => parseSkillFile(content, '/path/to/file.md', 'builtin')).toThrow(
      "missing required 'description' field"
    );
  });

  it('throws when name is not a string', () => {
    const content = `---
name: 123
description: Valid description
---
Instructions`;
    expect(() => parseSkillFile(content, '/path', 'builtin')).toThrow(
      "missing required 'name' field"
    );
  });

  it('throws when description is not a string', () => {
    // YAML might parse "true" as boolean, but gray-matter preserves strings
    // when quoted. Unquoted "true" may be parsed as boolean.
    // Let's test with an explicit non-string
    const content = `---
name: test
description:
  nested: object
---
Instructions`;
    expect(() => parseSkillFile(content, '/path', 'builtin')).toThrow(
      "missing required 'description' field"
    );
  });

  it('handles different source types', () => {
    const content = `---
name: test
description: Test
---
Body`;
    expect(parseSkillFile(content, '/p', 'builtin').source).toBe('builtin');
    expect(parseSkillFile(content, '/p', 'user').source).toBe('user');
    expect(parseSkillFile(content, '/p', 'project').source).toBe('project');
  });

  it('handles empty instructions body', () => {
    const content = `---
name: test
description: Test
---`;
    const skill = parseSkillFile(content, '/path', 'builtin');
    expect(skill.instructions).toBe('');
  });

  it('preserves markdown formatting in instructions', () => {
    const content = `---
name: analysis
description: Financial analysis skill
---
## Step 1: Data Collection

- Use \`get_income_statements\` for revenue data
- Use \`get_balance_sheets\` for asset data

## Step 2: Analysis

| Metric | Formula |
|--------|---------|
| ROE    | NI / Equity |`;
    const skill = parseSkillFile(content, '/path', 'builtin');
    expect(skill.instructions).toContain('## Step 1: Data Collection');
    expect(skill.instructions).toContain('`get_income_statements`');
    expect(skill.instructions).toContain('| Metric | Formula |');
  });
});
