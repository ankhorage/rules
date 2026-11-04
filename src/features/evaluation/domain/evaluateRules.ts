import type {
  EvaluateRulesOptions,
  Rule,
  RuleEvaluationDiagnostic,
  RuleEvaluationResult,
  RuleFinding,
  RuleSeverity,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';

const defaultRuleScope = { id: 'global', kind: 'global' } as const;

/*** Evaluate unrelated rules in deterministic identifier order through one generic mechanism. */
export function evaluateRules<TContext>(
  context: TContext,
  rules: readonly Rule<TContext>[],
  options: EvaluateRulesOptions = {},
): RuleEvaluationResult {
  const availableCapabilities = new Set(options.capabilities ?? []);
  const orderedRules = [...rules].sort((left, right) =>
    compareRuleEntityIds(left.identity, right.identity),
  );
  const results = orderedRules.map((rule) =>
    evaluateRule(context, rule, availableCapabilities, options),
  );

  return {
    diagnostics: results.flatMap((result) => result.diagnostics),
    findings: results.flatMap((result) => result.findings),
  };
}

/*** Evaluate one rule only when its declared input capabilities are available. */
function evaluateRule<TContext>(
  context: TContext,
  rule: Rule<TContext>,
  availableCapabilities: ReadonlySet<string>,
  options: EvaluateRulesOptions,
): {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly findings: readonly RuleFinding[];
} {
  const dependencyResult = rejectUnresolvedDependencies(rule);
  if (dependencyResult !== null) return dependencyResult;

  const missingCapabilities = (rule.requiredCapabilities ?? []).filter(
    (capability) => !availableCapabilities.has(capability),
  );
  if (missingCapabilities.length > 0) {
    return {
      findings: [],
      diagnostics: missingCapabilities.map((capability) => ({
        code: 'missing-capability',
        ruleId: rule.identity.id,
        message: `Rule "${rule.identity.id}" requires unavailable capability "${capability}".`,
      })),
    };
  }

  const ruleOptions = options.optionsByRuleId?.get(rule.identity.id);
  const optionDiagnostics = rule.validateOptions?.(ruleOptions) ?? [];
  if (optionDiagnostics.length > 0) {
    return {
      findings: [],
      diagnostics: optionDiagnostics.map((diagnostic) => ({
        code: 'invalid-options',
        ruleId: rule.identity.id,
        message: `Rule "${rule.identity.id}": ${diagnostic.message}`,
      })),
    };
  }

  return {
    diagnostics: [],
    findings: rule
      .evaluate({
        context,
        dependencyResults: [],
        options: ruleOptions,
        scope: options.scope ?? defaultRuleScope,
      })
      .findings.map((finding) =>
        canonicalizeFinding(finding, rule.identity.id, rule.defaultSeverity),
      ),
  };
}

/*** Reject dependency-bearing rules until the DAG evaluator resolves their complete closure. */
function rejectUnresolvedDependencies<TContext>(rule: Rule<TContext>): {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly findings: readonly RuleFinding[];
} | null {
  if (rule.dependencies.length === 0) return null;
  return {
    findings: [],
    diagnostics: [
      {
        code: 'unresolved-dependencies',
        ruleId: rule.identity.id,
        message: `Rule "${rule.identity.id}" declares dependencies and requires DAG evaluation.`,
      },
    ],
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
