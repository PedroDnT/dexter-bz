export interface Command {
  label: string;
  value: string; // The text to insert
  description: string;
}

export const SLASH_COMMANDS: Command[] = [
  { 
    label: '/briefing', 
    value: 'Generate a comprehensive market briefing for today focusing on Brazil and global drivers.', 
    description: 'Daily Market Pulse' 
  },
  { 
    label: '/tax', 
    value: 'Analyze the tax implications for ', 
    description: 'Brazil Tax Expert (IR/DARF)' 
  },
  { 
    label: '/portfolio', 
    value: 'Please analyze my portfolio structure: ', 
    description: 'Portfolio Advisor & Strategy' 
  },
  { 
    label: '/educator', 
    value: 'Explain the concept of ', 
    description: 'Financial Educator (Concepts)' 
  },
  { 
    label: '/fee', 
    value: 'Calculate the operational costs and net return for ', 
    description: 'Fee Calculator (Costs/Spreads)' 
  },
  { 
    label: '/comps', 
    value: 'Perform a comparable company analysis for ', 
    description: 'Valuation (Multiples)' 
  },
  { 
    label: '/investigate', 
    value: 'Run a fraud investigation on ', 
    description: 'Fraud Detection Pipeline' 
  },
  { 
    label: '/model', 
    value: '/model', 
    description: 'Switch AI Model' 
  },
  {
    label: '/help',
    value: 'What can you do?',
    description: 'Show capabilities'
  }
];
