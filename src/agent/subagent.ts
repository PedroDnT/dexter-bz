import { StructuredToolInterface } from '@langchain/core/tools';
import { Agent } from './agent.js';
import { AgentEvent, AgentConfig } from './types.js';
import { getTools } from '../tools/registry.js';
import { buildSystemPrompt } from './prompts.js';

export interface SubAgentConfig extends AgentConfig {
  name: string;
  description: string;
  systemPrompt?: string;
  tools?: StructuredToolInterface[];
}

/**
 * Runs a sub-agent loop to completion and returns the final answer.
 * @param query The query to run
 * @param config Configuration for the sub-agent
 * @returns The final answer string
 */
export async function runSubAgent(query: string, config: SubAgentConfig): Promise<string> {
  const model = config.model ?? 'gpt-5.2';
  // Use provided tools or get default tools for the model
  const tools = config.tools ?? getTools(model);
  // Use provided system prompt or generate default
  const systemPrompt = config.systemPrompt 
    ? config.systemPrompt
    : buildSystemPrompt(model);

  // If name/description provided, prepend to system prompt if not overridden
  const finalPrompt = config.systemPrompt 
    ? config.systemPrompt 
    : `You are ${config.name}, a specialized assistant.\n${config.description}\n\n${systemPrompt}`;

  const agent = Agent.create(config, tools, finalPrompt);
  
  const generator = agent.run(query);
  let result = await generator.next();
  let lastAnswer = "";

  while (!result.done) {
    const event = result.value;
    if (event.type === 'done') {
      lastAnswer = event.answer;
    }
    result = await generator.next();
  }

  return lastAnswer;
}
