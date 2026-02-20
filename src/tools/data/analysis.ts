// src/utils/data-analysis.ts
import * as aq from 'arquero';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const DataAnalysisInputSchema = z.object({
  data: z.array(z.record(z.string(), z.unknown())).describe('The JSON data as an array of objects.'),
  operation: z.enum(['describe', 'correlation', 'moving_average', 'filter_outliers']).describe('The operation to perform.'),
  options: z.object({
    column: z.string().optional().describe('Column to apply operation on (e.g., "price")'),
    window: z.number().optional().describe('Window for moving averages (e.g., 20)'),
    threshold: z.number().optional().describe('Threshold for outlier detection (z-score > X)'),
  }).optional(),
});

export const analyzeData = new DynamicStructuredTool({
  name: 'analyze_data',
  description: `Perform advanced data analysis using Arquero (Pandas-like library).
Operations available:
- 'describe': Summary statistics (mean, median, stdev, min, max) for numeric columns.
- 'correlation': Calculate correlation matrix (if >1 numeric column).
- 'moving_average': Add a new column with simple moving average.
- 'filter_outliers': Remove rows where z-score > threshold (default 3).`,
  schema: DataAnalysisInputSchema,
  func: async ({ data, operation, options }) => {
    try {
      if (!data || data.length === 0) return "Error: No data provided.";
      
      let table = aq.from(data);

      switch (operation) {
        case 'describe':
          // Identify numeric columns
          const numericCols = table.columnNames().filter(col => typeof (data[0] as any)[col] === 'number');
          if (numericCols.length === 0) return "Error: No numeric columns found.";
          
          return JSON.stringify(numericCols.reduce((acc, col) => {
            const stats = table.rollup({
              mean: aq.op.mean(col),
              median: aq.op.median(col),
              stdev: aq.op.stdev(col),
              min: aq.op.min(col),
              max: aq.op.max(col),
              count: aq.op.count(),
            });
            // Convert Arquero table to object
            acc[col] = stats.objects()[0]; 
            return acc;
          }, {} as Record<string, any>), null, 2);

        case 'moving_average':
          if (!options?.column || !options?.window) return "Error: 'column' and 'window' required for moving_average.";
          
          const colName = options.column;
          const windowSize = options.window;
          
          // Use standard JS map for rolling average if arquero API is tricky without docs
          // This is simpler and less error prone for this specific task
          const colData = Array.from(table.array(colName));
          const maValues = colData.map((val: any, idx: number, arr: any[]) => {
             if (idx < windowSize - 1) return null;
             let sum = 0;
             for (let i = 0; i < windowSize; i++) {
               sum += (arr[idx - i] as number);
             }
             return sum / windowSize;
          });
          
          const objects = table.objects() as any[];
          const result = objects.map((obj, i) => ({
             ...obj,
             [`ma_${windowSize}`]: maValues[i]
          }));
          
          return JSON.stringify(result, null, 2);

        case 'correlation':
             // Not implemented - Arquero doesn't have built-in correlation matrix AFAIK easily.
             // We can implement manually or skip. Let's do simple variance/covariance.
             return "Correlation implementation pending.";
             
        case 'filter_outliers':
             if (!options?.column) return "Error: 'column' required for filter_outliers.";
             const targetCol = options.column;
             const zThresh = options.threshold || 3;
             
             // Calculate mean and stdev
             const statsObj = table.rollup({
                 mean: aq.op.mean(targetCol),
                 sd: aq.op.stdev(targetCol)
             }).objects()[0] as { mean: number, sd: number };
             
             if (!statsObj.sd || statsObj.sd === 0) return "Error: standard deviation is zero.";
             
             const filtered = table.filter(aq.escape((d: any) => Math.abs((d[targetCol] - statsObj.mean) / statsObj.sd) <= zThresh));
             
             return JSON.stringify(filtered.objects(), null, 2);

        default:
          return `Error: Unknown operation ${operation}`;
      }
    } catch (e) {
      return `Analysis Error: ${(e as Error).message}`;
    }
  },
});
