import type { FraudInvestigationResult, ResolvedTarget } from './types.js';
import type { InvestigationTargetInput } from './types.js';
import { resolveTarget } from './resolve.js';
import { gatherFraudDataset } from './data.js';
import type { FraudDataOptions } from './data.js';
import { computeFraudSignals } from './anomalies.js';

export const DEFAULT_DISCLAIMER =
  'This output is a heuristic anomaly screening based on market and filings metadata. It is not proof of wrongdoing or fraud. False positives are possible. Validate any red flags with primary filings (SEC/CVM), auditor reports, and independent corroboration before drawing conclusions.';

export async function runFraudInvestigation(
  input: InvestigationTargetInput,
  options: FraudDataOptions = {}
): Promise<FraudInvestigationResult> {
  const resolved: ResolvedTarget = await resolveTarget(input.query);
  const target: ResolvedTarget = input.label ? { ...resolved, label: input.label } : resolved;
  const { dataset, sources, errors } = await gatherFraudDataset(target, options);
  const { flags, metrics } = computeFraudSignals(dataset);

  return {
    target,
    asOf: new Date().toISOString(),
    dataset,
    flags,
    metrics,
    sources,
    errors,
    disclaimer: DEFAULT_DISCLAIMER,
  };
}

