import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runSubAgent } from '../../../agent/subagent.js';
import { getTools } from '../../registry.js';

const TAX_AGENT_DESCRIPTION = `Use this tool for questions about Brazilian investment taxation (Imposto de Renda - IR).
This agent is an expert on Receita Federal rules for:
- Stock sales (Swing Trade 15% vs Day Trade 20%).
- The 20k BRL exemption rule for stocks.
- FIIs (20% on gain, dividends usually exempt).
- ETFs (15%, no exemption).
- 'Come-cotas' in funds.
- JCP (Interest on Equity) taxation.
- DARF calculation and payment obligations.
- Crypto taxation rules.`;

export function createBrazilTaxAgent(model: string) {
  return new DynamicStructuredTool({
    name: 'ask_brazil_tax_expert',
    description: TAX_AGENT_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The tax-related question or scenario to analyze.'),
    }),
    func: async ({ query }) => {
        // The tax agent needs tools to look up prices if calculating gains, but mostly it's knowledge-based.
        // We give it standard tools just in case.
        const tools = getTools(model); 
        
        return await runSubAgent(query, {
            name: 'Brazil Tax Expert',
            description: 'You are a specialist in Brazilian Investment Taxation (Receita Federal).',
            model: model,
            tools: tools,
            systemPrompt: `You are Dexter's Brazilian Tax specialist.

Your goal is to explain tax obligations for investments in Brazil.

**Key Knowledge Base (Receita Federal)**:
1. **Stocks (Ações)**:
   - Gains taxed at 15% (Swing Trade) or 20% (Day Trade).
   - **Exemption**: Sales under 20,000 BRL/month (Swing Trade only) are exempt from IR on gains.
   - Dividends: Currently exempt.
   - JCP: 15% withheld at source.

2. **FIIs (Real Estate Funds)**:
   - Gains taxed at 20% (Swing or Day Trade).
   - **NO Exemption** for sales under 20k.
   - Dividends: Exempt for individuals (if fund has >50 cotistas & traded on exchange).

3. **ETFs**:
   - Equity ETFs: 15% on gains.
   - Fixed Income ETFs: Sliding scale or 15% depending on average maturity.
   - **NO Exemption** for sales under 20k.

4. **BDRs**:
   - Taxed at 15% on gains.
   - **NO Exemption** for sales under 20k.
   - Dividends from abroad: Subject to Carnê-Leão (progressive table).

5. **Crypto**:
   - Exemption for sales under 35,000 BRL/month (aggregate of all crypto assets).
   - Above that: 15% on gains (up to 5M).

**Guidelines**:
- Always warn that you are an AI and this is not legal/accounting advice.
- When calculating, ask for buy price and sell price if not provided.
- Remind users about DARF issuance (needs to be paid by the last business day of the following month).`
        });
    },
  });
}
