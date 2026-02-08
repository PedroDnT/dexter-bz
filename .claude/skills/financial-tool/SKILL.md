---
name: financial-tool
description: Create a new financial data tool following project patterns
---

# Financial Tool Creator

Create a new financial data tool in `src/tools/finance/` following project conventions.

## Steps

1. **Create the tool file** in `src/tools/finance/<tool-name>.ts`

2. **Follow the established pattern**:
   - Export a Zod schema for input validation
   - Export the main tool function with proper error handling
   - Use the FMP API client from `api.ts` or create a new provider in `providers/`
   - Include proper TypeScript types

3. **Reference these files for patterns**:
   - `src/tools/finance/key-ratios.ts` - Simple FMP tool example
   - `src/tools/finance/api.ts` - FMP API client
   - `src/tools/finance/brazil-features.ts` - Brazil-specific integrations
   - `src/tools/types.ts` - Common types

4. **Register the tool** in `src/tools/finance/index.ts`

5. **Add tests** in `src/__tests__/` if the tool has complex logic

## Tool Structure Template

```typescript
import { z } from 'zod';
import { fmpRequest } from './api.js';

export const <toolName>Schema = z.object({
  ticker: z.string().describe('Stock ticker symbol'),
  // ... other params
});

export type <ToolName>Input = z.infer<typeof <toolName>Schema>;

export async function <toolName>(input: <ToolName>Input): Promise<Result> {
  const { ticker } = input;

  const data = await fmpRequest(`/endpoint/${ticker}`);

  return {
    // ... processed result
  };
}
```
