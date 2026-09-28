import type {
  EvaluateRulesOptions,
  Rule,
  RuleEvaluationDiagnostic,
  RuleEvaluationResult,
  RuleFinding,
  RuleSeverity,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';

/*** Evaluate unrelated rules in deterministic identifier order through one generic mechanism. */
export function evaluateRules<TContext>(
  context: TContext,
  rules: readonly Rule<TContext>[],
  options: EvaluateRulesOptions = {},
): RuleEvaluationResult {
  const availableCapabilities = new Set(options.capabilities ?? []);
  const orderedRules = [...rules].sort(compareRuleEntityIds);
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
  const missingCapabilities = (rule.requiredCapabilities ?? []).filter(
    (capability) => !availableCapabilities.has(capability),
  );
  if (missingCapabilities.length > 0) {
    return {
      findings: [],
      diagnostics: missingCapabilities.map((capability) => ({
        code: 'missing-capability',
        ruleId: rule.id,
        message: `Rule "${rule.id}" requires unavailable capability "${capability}".`,
      })),
    };
  }

  const ruleOptions = options.optionsByRuleId?.get(rule.id);
  const optionDiagnostics = rule.validateOptions?.(ruleOptions) ?? [];
  if (optionDiagnostics.length > 0) {
    return {
      findings: [],
      diagnostics: optionDiagnostics.map((diagnostic) => ({
        code: 'invalid-options',
        ruleId: rule.id,
        message: `Rule "${rule.id}": ${diagnostic.message}`,
      })),
    };
  }

  return {
    diagnostics: [],
    findings: rule
      .evaluate({ context, options: ruleOptions })
      .map((finding) => canonicalizeFinding(finding, rule.id, rule.defaultSeverity)),
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
  };
}
