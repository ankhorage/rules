import type {
  EvaluateRulesOptions,
  RuleEvaluationCacheKey,
  RuleEvaluationPlanNode,
  RuleResult,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';

/*** Build the complete cache identity only when callers provide both fact and authenticated partition versions. */
export function createRuleEvaluationCacheKey(
  node: RuleEvaluationPlanNode,
  dependencyResults: readonly RuleResult[],
  options: Pick<
    EvaluateRulesOptions,
    'cachePartition' | 'capabilities' | 'factsVersion' | 'optionsByRuleId'
  >,
): RuleEvaluationCacheKey | null {
  if (options.cachePartition === undefined || options.factsVersion === undefined) return null;

  return {
    capabilities: [...new Set(options.capabilities ?? [])].sort(compareStrings),
    dependencyResults: dependencyResults.map(stripExecutionProvenance),
    factsVersion: options.factsVersion,
    options: options.optionsByRuleId?.get(node.rule.id),
    partition: options.cachePartition,
    rule: node.rule,
    scope: node.scope,
  };
}

/*** Do not let transient cache provenance invalidate otherwise identical dependent outcomes. */
function stripExecutionProvenance(result: RuleResult): RuleResult {
  const { execution: _execution, ...cacheIdentityResult } = result;
  return cacheIdentityResult;
}

/*** Compare identifiers without locale-dependent ordering. */
function compareStrings(left: string, right: string): number {
  return compareRuleEntityIds({ id: left }, { id: right });
}
