import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runSubAgent } from '../../../agent/subagent.js';

const EDUCATOR_AGENT_DESCRIPTION = `Use this tool when the user asks for an explanation of a financial concept, metric, or complex market mechanism.
This agent is an expert teacher who:
- Explains concepts simply (ELI5 or professional level based on context).
- Uses analogies to make abstract finance topics concrete.
- Can explain Brazil-specific nuances (e.g., JCP vs Dividends, Come-Cotas).
- Does NOT look up real-time prices unless necessary for an example.

Examples:
- "What is EBITDA?"
- "How does 'come-cotas' work in Brazilian funds?"
- "Explain the difference between ON and PN shares."`;

export function createFinancialEducatorAgent(model: string) {
  return new DynamicStructuredTool({
    name: 'ask_financial_educator',
    description: EDUCATOR_AGENT_DESCRIPTION,
    schema: z.object({
      topic: z.string().describe('The financial concept or topic the user wants explained.'),
      complexity: z.enum(['beginner', 'advanced']).optional().describe('Target audience level.'),
    }),
    func: async ({ topic, complexity }) => {
        const systemPrompt = `You are Dexter's Financial Educator module. 
Your goal is to explain financial concepts clearly, accurately, and engagingly.

Context:
- User is asking about: "${topic}"
- Target Level: ${complexity || 'adaptive (match user tone)'}

Guidelines:
1. **Define it**: Start with a clear, 1-sentence definition.
2. **Contextualize**: Explain WHY it matters to an investor.
3. **Brazil Specifics**: If relevant, mention how this works in Brazil (B3, CVM rules, Tax).
   - Example: If explaining Dividends, mention JCP (Interest on Equity) and the 15% tax difference.
   - Example: If explaining ETFs, mention the lack of tax exemption for sales under 20k BRL.
4. **Analogies**: Use real-world analogies if the concept is abstract (like Derivatives or Short Selling).

Do not hallucinate data. If you need examples, use hypothetical numbers or well-known historical cases.`;

        // The educator doesn't strictly need external tools for definitions, but giving it search helps with niche topics.
        // We'll give it a light subset of tools if possible, or just the main ones.
        const { getTools } = await import('../../registry.js');
        const tools = getTools(model); 

        return await runSubAgent(`Explain ${topic}`, {
            name: 'Financial Educator',
            description: 'You are a patient and knowledgeable financial tutor.',
            model: model,
            tools: tools,
            systemPrompt: systemPrompt
        });
    },
  });
}
