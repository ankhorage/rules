import type {
  RuleEvaluationCache,
  RuleEvaluationCacheKey,
  RuleEvaluationPlanNode,
  RuleResult,
} from '../../../types/rules.js';

/*** Read a matching cached result without allowing cache failures or mismatches to fabricate reuse. */
export function readCachedRuleResult(
  cache: RuleEvaluationCache | undefined,
  cacheKey: RuleEvaluationCacheKey,
  node: RuleEvaluationPlanNode,
): RuleResult | undefined {
  try {
    const result = cache?.read(cacheKey);
    return result !== undefined && hasMatchingIdentity(result, node) ? result : undefined;
  } catch {
    return undefined;
  }
}

/*** Reject cache data that does not belong to the evaluated rule instance. */
function hasMatchingIdentity(result: RuleResult, node: RuleEvaluationPlanNode): boolean {
  return (
    result.rule.id === node.rule.id &&
    result.rule.version === node.rule.version &&
    result.scope.id === node.scope.id &&
    result.scope.kind === node.scope.kind
  );
}
