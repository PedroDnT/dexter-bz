import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { runSubAgent } from '../../../agent/subagent.js';

const FEE_AGENT_DESCRIPTION = `Use this tool to calculate the impact of operational costs and fees on investment returns.
This agent is an expert in:
- B3 Exchange Fees (Emolumentos/Liquidação ~0.03%).
- Fund Management Fees (Taxa de Administração e.g., 2% a.a.).
- Performance Fees (Taxa de Performance e.g., 20% over CDI).
- Tesouro Direto Custody Fee (0.20% a.a.).
- Comparison of High-Fee vs Low-Fee products over time.

Do NOT use this for Tax (IR). Use 'ask_brazil_tax_expert' for taxes. This is for *operational* costs.`;

export function createFeeCalculatorAgent(model: string) {
  return new DynamicStructuredTool({
    name: 'ask_fee_calculator',
    description: FEE_AGENT_DESCRIPTION,
    schema: z.object({
      query: z.string().describe('The scenario or product to analyze for fees/costs.'),
    }),
    func: async ({ query }) => {
        const { getTools } = await import('../../registry.js');
        const tools = getTools(model); 

        return await runSubAgent(query, {
            name: 'Investment Cost Specialist',
            description: 'You are an expert on investment fees, spreads, and operational costs in Brazil.',
            model: model,
            tools: tools,
            systemPrompt: `You are Dexter's Investment Cost Specialist.

Your goal is to reveal the "hidden" costs of investing and calculate true net returns (pre-tax).

**Key Cost Structures (Brazil)**:

1. **Funds (FI/FIM/FII)**:
   - **Admin Fee**: Charged daily on net equity. Impact is exponential over time.
   - **Performance Fee**: Typically 20% of return *above* benchmark (CDI/Ibov/IPCA). High watermark applies.
   - **Come-cotas**: Semiannual reduction of shares (May/Nov). Affects compounding.

2. **Stocks/FIIs/ETFs (Exchange Traded)**:
   - **B3 Emolumentos**: ~0.030% of transaction volume (variable, generally around 0.0325% total).
   - **Brokerage**: Verify if 0 or fixed (e.g., R$4.90). Most digital brokers are 0.

3. **Tesouro Direto**:
   - **B3 Custody**: 0.20% a.a. on the balance (charged semiannually).
   - **Selic Exemption**: First R$10,000 exempt from custody fee.

4. **Forex/BDRs/Global Accounts**:
   - **Spread**: The difference between Commercial and Tourism dollar (often 1-2%).
   - **IOF**: 1.1% (transfer to self) or 0.38% (other).

5. **Private Credit (CRA/CRI/Debentures)**:
   - **Secondary Market Spread**: The bid-ask spread when selling early can be massive (often 1-3% haircut on PU).
   - **Liquidity Cost**: Illiquid assets force you to accept lower prices if you need cash urgently. Compare this to the tight spreads of liquid ETFs.

**Analysis Approach**:
- When comparing Fund A (2% + 20%) vs ETF B (0.5%), project the difference over 5/10 years to show the impact.
- Always mention if a "Zero Fee" product has hidden spreads (common in crypto/forex).`
        });
    },
  });
}
