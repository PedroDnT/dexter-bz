import { StructuredToolInterface } from '@langchain/core/tools';
import { createFinancialSearch } from './finance/financial-search.js';
import { createFinancialMetrics } from './finance/financial-metrics.js';
import { portfolioPerformance } from './finance/portfolio-performance.js';
import { createBrazilMarketAgent } from './subagents/brazil/market_agent.js';
import { createBrazilTaxAgent } from './subagents/brazil/tax_agent.js';
import { createFinancialEducatorAgent } from './subagents/educator/educator_agent.js';
import { createPortfolioAdvisorAgent } from './subagents/advisor/portfolio_agent.js';
import { createFeeCalculatorAgent } from './subagents/calculator/fee_agent.js';
import { browsePage } from './search/browser.js';
import { analyzeData } from './data/analysis.js';
import { exaSearch } from './search/exa.js';
import { tavilySearch } from './search/tavily.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { FINANCIAL_SEARCH_DESCRIPTION } from './descriptions/financial-search.js';
import { FINANCIAL_METRICS_DESCRIPTION } from './descriptions/financial-metrics.js';
import { PORTFOLIO_PERFORMANCE_DESCRIPTION } from './descriptions/portfolio-performance.js';
import { WEB_SEARCH_DESCRIPTION } from './descriptions/web-search.js';
import { discoverSkills } from '../skills/registry.js';

/**
 * A registered tool with its rich description for system prompt injection.
 */
export interface RegisteredTool {
  /** Tool name (must match the tool's name property) */
  name: string;
  /** The actual tool instance */
  tool: StructuredToolInterface;
  /** Rich description for system prompt (includes when to use, when not to use, etc.) */
  description: string;
}

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'financial_search',
      tool: createFinancialSearch(model),
      description: FINANCIAL_SEARCH_DESCRIPTION,
    },
    {
      name: 'financial_metrics',
      tool: createFinancialMetrics(model),
      description: FINANCIAL_METRICS_DESCRIPTION,
    },
    {
      name: 'portfolio_performance',
      tool: portfolioPerformance,
      description: PORTFOLIO_PERFORMANCE_DESCRIPTION,
    },
    {
      name: 'ask_brazil_market_expert',
      tool: createBrazilMarketAgent(model),
      description: 'Consult a specialized sub-agent for complex queries about Brazilian markets (B3), companies, and filings.',
    },
    {
      name: 'ask_financial_educator',
      tool: createFinancialEducatorAgent(model),
      description: 'Explain financial concepts, metrics, or mechanisms simply (e.g., "What is EBITDA?", "How do options work?").',
    },
    {
      name: 'ask_portfolio_advisor',
      tool: createPortfolioAdvisorAgent(model),
      description: 'Analyze user portfolios, discuss allocation strategy, and suggest diversification (educational only).',
    },
    {
      name: 'ask_brazil_tax_expert',
      tool: createBrazilTaxAgent(model),
      description: 'Analyze tax implications (IR, DARF, exemptions) for Brazilian investments (Stocks, FIIs, ETFs, Crypto).',
    },
    {
      name: 'ask_fee_calculator',
      tool: createFeeCalculatorAgent(model),
      description: 'Calculate operational costs (B3 fees, fund admin fees, performance fees) to find true net returns.',
    },
    {
      name: 'browse_page',
      tool: browsePage,
      description: 'Fetch web page content using a headless browser (Puppeteer) - use for JS-heavy sites or scraping.',
    },
    {
      name: 'analyze_data',
      tool: analyzeData,
      description: 'Perform advanced data analysis (stats, moving averages, etc.) on JSON datasets.',
    },
  ];

  // Include web_search if Exa or Tavily API key is configured (Exa preferred)
  if (process.env.EXASEARCH_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: exaSearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  } else if (process.env.TAVILY_API_KEY) {
    tools.push({
      name: 'web_search',
      tool: tavilySearch,
      description: WEB_SEARCH_DESCRIPTION,
    });
  }

  // Include skill tool if any skills are available
  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({
      name: 'skill',
      tool: skillTool,
      description: SKILL_TOOL_DESCRIPTION,
    });
  }

  return tools;
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @returns Array of tool instances
 */
export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @returns Formatted string with all tool descriptions
 */
export function buildToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `### ${t.name}\n\n${t.description}`)
    .join('\n\n');
}
