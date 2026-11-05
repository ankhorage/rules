import type { RuleExecutionProvenance, RuleResult } from '../../../types/rules.js';

/*** Resolve absent legacy provenance truthfully instead of inferring cache reuse from result equality. */
export function getRuleExecutionProvenance(result: RuleResult): RuleExecutionProvenance {
  return result.execution ?? 'unknown';
}
