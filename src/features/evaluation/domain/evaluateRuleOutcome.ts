import type {
  JsonValue,
  Rule,
  RuleEvaluationCache,
  RuleEvaluationCacheKey,
  RuleEvaluationPlanNode,
  RuleFinding,
  RuleResult,
  RuleSeverity,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';
import { createRuleResult } from './createRuleResult.js';
import { writeCachedRuleResult } from './writeCachedRuleResult.js';

/*** Invoke a provider, preserve its factual outcome, and cache only that genuine evaluation. */
export function evaluateRuleOutcome<TContext>(
  context: TContext,
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  dependencyResults: readonly RuleResult[],
  options: JsonValue | undefined,
  cache: RuleEvaluationCache | undefined,
  cacheKey: RuleEvaluationCacheKey | null,
): RuleResult {
  try {
    const outcome = rule.evaluate({
      context,
      dependencyResults: Object.freeze([...dependencyResults]),
      options,
      scope: node.scope,
    });
    const result = createRuleResult(
      rule,
      node,
      outcome.status,
      outcome.findings.map((finding) =>
        canonicalizeFinding(finding, rule.identity.id, rule.defaultSeverity),
      ),
      [],
      'evaluated',
    );
    writeCachedRuleResult(cache, cacheKey, result);
    return result;
  } catch {
    return createRuleResult(
      rule,
      node,
      'ERROR',
      [],
      [createRuleErrorDiagnostic(rule)],
      'evaluated',
    );
  }
}

/*** Create a stable diagnostic when the evaluator catches a provider exception. */
function createRuleErrorDiagnostic<TContext>(rule: Rule<TContext>) {
  return {
    code: 'rule-error' as const,
    ruleId: rule.identity.id,
    message: `Rule "${rule.identity.id}" threw while the evaluator invoked it.`,
  };
}

/*** Preserve provider evidence while making identifier and severity engine-controlled facts. */
function canonicalizeFinding(
  finding: RuleFinding,
  ruleId: string,
  severity: RuleSeverity,
): RuleFinding {
  return {
    ...finding,
    ruleId,
    severity,
    subjects: [...finding.subjects].sort(compareRuleEntityIds),
  };
}
