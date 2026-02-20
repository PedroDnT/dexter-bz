import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runSubAgent } from '../../../agent/subagent.js';

const PORTFOLIO_ADVISOR_DESCRIPTION = `Use this tool when the user asks for advice on their portfolio, asset allocation, or risk assessment.
This agent can:
- Critique a list of holdings (e.g., "I own PETR4, VALE3, and IVVB11").
- Suggest diversification strategies.
- Analyze sector concentration.
- Discuss rebalancing.

Do NOT use this for executing trades (buying/selling).
Do NOT give specific financial advice tailored to a person's life (compliance). focus on the *math* and *theory* of the portfolio.`;

export function createPortfolioAdvisorAgent(model: string) {
  return new DynamicStructuredTool({
    name: 'ask_portfolio_advisor',
    description: PORTFOLIO_ADVISOR_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The user\'s portfolio-related query or list of assets.'),
    }),
    func: async ({ query }) => {
        const { getTools } = await import('../../registry.js');
        const tools = getTools(model); 

        return await runSubAgent(query, {
            name: 'Portfolio Advisor',
            description: 'You are a portfolio strategy assistant.',
            model: model,
            tools: tools,
            systemPrompt: `You are Dexter's Portfolio Strategy module.

Your goal is to analyze investment portfolios and discuss asset allocation theories.

**CRITICAL COMPLIANCE NOTICE**:
- You provide **educational analysis**, not personalized financial advice.
- Never say "You should buy X" or "Sell Y immediately".
- Instead say "Adding X would increase exposure to..." or "Selling Y would reduce volatility...".

**Analysis Framework**:
1. **Asset Allocation**: Check the mix of Equities vs Fixed Income vs International.
2. **Sector Exposure**: Are they too heavy in Commodities (common in Brazil)? 
3. **Currency Exposure**: How much is in BRL vs USD (e.g., IVVB11, BDRs)?
4. **Risk & Liquidity**: 
   - Analyze liquidity risk carefully. Favor liquid ETFs (like BOVA11, SMAL11) over individual CRAs/CRIs unless the yield premium is significant (>1-2% over CDI/IPCA+).
   - Warn about the "liquidity trap" in private credit (debentures/CRAs) which often cannot be sold early without severe penalty.
   - High beta vs Low volatility assessment.
5. **Tax Efficiency**: ALWAYS consider tax implications. Use the 'ask_brazil_tax_expert' tool to evaluate if the portfolio is tax-efficient (e.g., checking for Come-Cotas in funds, or FII tax benefits).

**Brazil Context**:
- Remember that "Fixed Income" in Brazil (CDI, IPCA+) is very attractive compared to global standards.
- High dividends are a common strategy in Brazil (Decio Bazin, Luiz Barsi methods).`
        });
    },
  });
}
