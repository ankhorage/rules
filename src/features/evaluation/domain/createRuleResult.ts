import type {
  Rule,
  RuleEvaluationPlanNode,
  RuleExecutionProvenance,
  RuleFinding,
  RuleResult,
  RuleResultDiagnostic,
} from '../../../types/rules.js';
import { freezeRuleResult } from './freezeRuleResult.js';

/*** Assemble an immutable serializable result without inferring status from findings. */
export function createRuleResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  status: RuleResult['status'],
  findings: readonly RuleFinding[],
  diagnostics: readonly RuleResultDiagnostic[],
  execution: RuleExecutionProvenance = 'not-executed',
): RuleResult {
  return freezeRuleResult({
    diagnostics,
    execution,
    findings,
    rule: Object.freeze({ ...rule.identity }),
    scope: Object.freeze({ ...node.scope }),
    status,
  });
}
