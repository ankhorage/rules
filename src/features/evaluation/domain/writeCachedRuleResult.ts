import type {
  RuleEvaluationCache,
  RuleEvaluationCacheKey,
  RuleResult,
} from '../../../types/rules.js';

/*** Persist only a result produced by actual provider evaluation; cache failures preserve evaluation behavior. */
export function writeCachedRuleResult(
  cache: RuleEvaluationCache | undefined,
  cacheKey: RuleEvaluationCacheKey | null,
  result: RuleResult,
): void {
  if (cacheKey === null) return;
  try {
    cache?.write(cacheKey, result);
  } catch {
    // The optional adapter cannot change a rule's evaluated outcome.
  }
}
