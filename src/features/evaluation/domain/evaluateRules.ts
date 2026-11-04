import type {
  EvaluateRulesOptions,
  JsonValue,
  Rule,
  RuleEvaluationDiagnostic,
  RuleEvaluationResult,
  RuleFinding,
  RuleResult,
  RuleResultDiagnostic,
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
    diagnostics: results.flatMap(toEvaluationDiagnostics),
    findings: results.flatMap((result) => result.findings),
    results,
  };
}

/*** Evaluate one rule only when its declared input capabilities are available. */
function evaluateRule<TContext>(
  context: TContext,
  rule: Rule<TContext>,
  availableCapabilities: ReadonlySet<string>,
  options: EvaluateRulesOptions,
): RuleResult {
  const scope = options.scope ?? defaultRuleScope;
  const ruleOptions = options.optionsByRuleId?.get(rule.identity.id);
  const prerequisiteResult = evaluatePrerequisites(rule, scope, availableCapabilities, ruleOptions);
  if (prerequisiteResult !== null) return prerequisiteResult;

  const outcome = rule.evaluate({
    context,
    dependencyResults: [],
    options: ruleOptions,
    scope,
  });
  return createRuleResult(
    rule,
    scope,
    outcome.status,
    outcome.findings.map((finding) =>
      canonicalizeFinding(finding, rule.identity.id, rule.defaultSeverity),
    ),
    [],
  );
}

/*** Stop a flat evaluation before a rule runs when its required execution facts are unavailable. */
function evaluatePrerequisites<TContext>(
  rule: Rule<TContext>,
  scope: RuleResult['scope'],
  availableCapabilities: ReadonlySet<string>,
  ruleOptions: JsonValue | undefined,
): RuleResult | null {
  const dependencyDiagnostic = rejectUnresolvedDependencies(rule);
  if (dependencyDiagnostic !== null) {
    return createRuleResult(rule, scope, 'INCOMPLETE', [], [dependencyDiagnostic]);
  }

  const missingCapabilities = (rule.requiredCapabilities ?? []).filter(
    (capability) => !availableCapabilities.has(capability),
  );
  if (missingCapabilities.length > 0) {
    return createRuleResult(
      rule,
      scope,
      'INCOMPLETE',
      [],
      missingCapabilities.map((capability) => ({
        code: 'missing-capability',
        ruleId: rule.identity.id,
        message: `Rule "${rule.identity.id}" requires unavailable capability "${capability}".`,
      })),
    );
  }

  const optionDiagnostics = rule.validateOptions?.(ruleOptions) ?? [];
  return optionDiagnostics.length === 0
    ? null
    : createRuleResult(
        rule,
        scope,
        'ERROR',
        [],
        optionDiagnostics.map((diagnostic) => ({
          code: 'invalid-options',
          ruleId: rule.identity.id,
          message: `Rule "${rule.identity.id}": ${diagnostic.message}`,
        })),
      );
}

/*** Reject dependency-bearing rules until the DAG evaluator resolves their complete closure. */
function rejectUnresolvedDependencies<TContext>(rule: Rule<TContext>): RuleResultDiagnostic | null {
  if (rule.dependencies.length === 0) return null;
  return {
    code: 'unresolved-dependencies',
    ruleId: rule.identity.id,
    message: `Rule "${rule.identity.id}" declares dependencies and requires DAG evaluation.`,
  };
}

/*** Assemble one canonical rule result without inferring a status from the presence of findings. */
function createRuleResult<TContext>(
  rule: Rule<TContext>,
  scope: RuleResult['scope'],
  status: RuleResult['status'],
  findings: readonly RuleFinding[],
  diagnostics: readonly RuleResultDiagnostic[],
): RuleResult {
  return { diagnostics, findings, rule: rule.identity, scope, status };
}

/*** Expose per-rule diagnostics through the legacy aggregate result without dropping rule identity. */
function toEvaluationDiagnostics(result: RuleResult): readonly RuleEvaluationDiagnostic[] {
  return result.diagnostics.map((diagnostic) => ({
    ...diagnostic,
    ruleId: diagnostic.ruleId ?? result.rule.id,
  }));
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
