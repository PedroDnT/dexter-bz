import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runSubAgent } from '../../../agent/subagent.js';
import { getTools } from '../../registry.js';
import { getPrices } from '../../finance/prices.js';
import { getFilings } from '../../finance/filings.js';
import { getNews } from '../../finance/news.js';
// Import other specific brazil relevant tools if needed

const BRAZIL_MARKET_AGENT_DESCRIPTION = `Use this tool to delegate complex questions about the Brazilian Market (B3) to a specialized agent.
This agent is an expert in:
- B3 stocks (PETR4, VALE3, ITUB4, etc.)
- Real Estate Funds (FIIs like KNRI11, HGLG11)
- CVM Filings (DFP, ITR, Reference Forms)
- Brazil-specific market trends and news.

Do NOT use this for simple price lookups (use financial_search).
Use this for detailed analysis, multi-step research, or when deep context on Brazil is needed.`;

export function createBrazilMarketAgent(model: string) {
  return new DynamicStructuredTool({
    name: 'ask_brazil_market_expert',
    description: BRAZIL_MARKET_AGENT_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The natural language query to ask the Brazil Market Expert.'),
    }),
    func: async ({ query }) => {
        // We can curate the tools here. For now, let's give it the main registry tools 
        // OR the low-level finance tools. 
        // Giving it the main registry tools (financial_search) allows it to use the router, 
        // effectively making it a high-level orchestration agent.
        const tools = getTools(model); 
        
        return await runSubAgent(query, {
            name: 'Brazil Market Expert',
            description: 'You are a specialized agent focused on the Brazilian Financial Market (B3).',
            model: model,
            tools: tools, // Or a subset
            systemPrompt: `You are an expert analyst for the Brazilian financial market (B3).

Your capabilities:
- Analysis of B3 companies (Stocks, REITs/FIIs, ETFs)
- Interpretation of CVM filings (DFP, ITR, FRE)
- Understanding of Brazil's macroeconomic context

Guidelines:
- Tickers usually follow XXXX3 (Common), XXXX4 (Preferred), XXXX11 (Units/Funds/ETFs).
- Always consider the currency context (BRL vs USD). PTAX is the reference for FX.
- Use available tools to fetch data before answering.
- Be concise but thorough in your analysis.

When users ask about "Petrobras", look for PETR3/PETR4.
When users ask about "Vale", look for VALE3.
For FIIs (Real Estate Funds), they always end in 11 (e.g., KNRI11).`
        });
    },
  });
}
