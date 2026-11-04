import type {
  EvaluateRulesOptions,
  JsonValue,
  Rule,
  RuleEvaluationDiagnostic,
  RuleEvaluationPlanNode,
  RuleEvaluationResult,
  RuleFinding,
  RuleResult,
  RuleResultDiagnostic,
  RuleSeverity,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';
import { createRuleEvaluationPlan } from './createRuleEvaluationPlan.js';
import { freezeRuleResult } from './freezeRuleResult.js';

/*** Evaluate a deterministic dependency plan once, passing completed child results to each provider. */
export function evaluateRules<TContext>(
  context: TContext,
  rules: readonly Rule<TContext>[],
  options: EvaluateRulesOptions = {},
): RuleEvaluationResult {
  const plan = createRuleEvaluationPlan(rules, options);
  const rulesById = new Map(rules.map((rule) => [rule.identity.id, rule]));
  const diagnosticsByRuleId = groupDiagnosticsByRuleId(plan.diagnostics);
  const availableCapabilities = new Set(options.capabilities ?? []);
  const disabledRuleIds = new Set(options.disabledRuleIds ?? []);
  const resultsByRuleId = new Map<string, RuleResult>();

  for (const node of plan.nodes) {
    const rule = rulesById.get(node.rule.id);
    if (rule === undefined) continue;
    const result = evaluatePlanNode(
      context,
      rule,
      node,
      diagnosticsByRuleId.get(node.rule.id) ?? [],
      resultsByRuleId,
      availableCapabilities,
      disabledRuleIds,
      options,
    );
    resultsByRuleId.set(node.rule.id, result);
  }

  const results = plan.nodes.flatMap((node) => {
    const result = resultsByRuleId.get(node.rule.id);
    return result === undefined ? [] : [result];
  });
  return {
    diagnostics: [
      ...plan.diagnostics.filter((diagnostic) => !resultsByRuleId.has(diagnostic.ruleId)),
      ...results.flatMap(toEvaluationDiagnostics),
    ].sort(compareDiagnostics),
    findings: results.flatMap((result) => result.findings),
    plan,
    results,
  };
}

/*** Evaluate one planned rule only after plan, dependency, and provider prerequisites are complete. */
function evaluatePlanNode<TContext>(
  context: TContext,
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  planDiagnostics: readonly RuleEvaluationDiagnostic[],
  resultsByRuleId: ReadonlyMap<string, RuleResult>,
  availableCapabilities: ReadonlySet<string>,
  disabledRuleIds: ReadonlySet<string>,
  options: EvaluateRulesOptions,
): RuleResult {
  const planFailure = createPlanFailureResult(rule, node, planDiagnostics);
  if (planFailure !== null) return planFailure;
  if (disabledRuleIds.has(rule.identity.id)) return createDisabledResult(rule, node);
  const dependencyResults = resolveDependencyResults(node, resultsByRuleId);
  const dependencyFailure = createDependencyFailureResult(rule, node, dependencyResults);
  if (dependencyFailure !== null) return dependencyFailure;
  const ruleOptions = options.optionsByRuleId?.get(rule.identity.id);
  const prerequisiteResult = evaluatePrerequisites(rule, node, availableCapabilities, ruleOptions);
  if (prerequisiteResult !== null) return prerequisiteResult;

  try {
    const outcome = rule.evaluate({
      context,
      dependencyResults: Object.freeze([...dependencyResults]),
      options: ruleOptions,
      scope: node.scope,
    });
    return createRuleResult(
      rule,
      node,
      outcome.status,
      outcome.findings.map((finding) =>
        canonicalizeFinding(finding, rule.identity.id, rule.defaultSeverity),
      ),
      [],
    );
  } catch {
    return createRuleResult(rule, node, 'ERROR', [], [createRuleErrorDiagnostic(rule)]);
  }
}
/*** Convert planner failures into an evaluator error without invoking provider code. */
function createPlanFailureResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  diagnostics: readonly RuleEvaluationDiagnostic[],
): RuleResult | null {
  const relevantDiagnostics = diagnostics.filter(
    (diagnostic) =>
      diagnostic.code === 'ambiguous-rule-id' ||
      diagnostic.code === 'cycle' ||
      diagnostic.code === 'missing-dependency',
  );
  return relevantDiagnostics.length === 0
    ? null
    : createRuleResult(rule, node, 'ERROR', [], relevantDiagnostics);
}
/*** Mark an explicitly disabled closure member incomplete without treating it as an executed provider. */
function createDisabledResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
): RuleResult {
  return createRuleResult(
    rule,
    node,
    'INCOMPLETE',
    [],
    [
      {
        code: 'disabled-dependency',
        message: `Rule "${rule.identity.id}" is disabled for this evaluation.`,
        ruleId: rule.identity.id,
      },
    ],
  );
}
/*** Collect completed direct child results in the plan's stable dependency order. */
function resolveDependencyResults(
  node: RuleEvaluationPlanNode,
  resultsByRuleId: ReadonlyMap<string, RuleResult>,
): readonly RuleResult[] {
  return node.dependencyRuleIds.flatMap((dependencyRuleId) => {
    const dependencyResult = resultsByRuleId.get(dependencyRuleId);
    return dependencyResult === undefined ? [] : [dependencyResult];
  });
}

/*** Prevent a provider from running when a child could not establish complete execution evidence. */
function createDependencyFailureResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  dependencyResults: readonly RuleResult[],
): RuleResult | null {
  const missingDependencyRuleIds = node.dependencyRuleIds.filter(
    (dependencyRuleId) => !dependencyResults.some((result) => result.rule.id === dependencyRuleId),
  );
  if (missingDependencyRuleIds.length > 0) {
    return createRuleResult(
      rule,
      node,
      'ERROR',
      [],
      missingDependencyRuleIds.map((dependencyRuleId) => ({
        code: 'dependency-error',
        message: `Rule "${rule.identity.id}" could not receive result for dependency "${dependencyRuleId}".`,
        ruleId: rule.identity.id,
      })),
    );
  }
  const erroredDependencyRuleIds = dependencyResults
    .filter((result) => result.status === 'ERROR')
    .map((result) => result.rule.id);
  if (erroredDependencyRuleIds.length > 0) {
    return createRuleResult(
      rule,
      node,
      'ERROR',
      [],
      erroredDependencyRuleIds.map((dependencyRuleId) => ({
        code: 'dependency-error',
        message: `Rule "${rule.identity.id}" depends on errored rule "${dependencyRuleId}".`,
        ruleId: rule.identity.id,
      })),
    );
  }
  return createIncompleteDependencyResult(rule, node, dependencyResults);
}

/*** Stop a parent after a child reports incomplete execution evidence. */
function createIncompleteDependencyResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  dependencyResults: readonly RuleResult[],
): RuleResult | null {
  const incompleteDependencyRuleIds = dependencyResults
    .filter((result) => result.status === 'INCOMPLETE' || result.status === 'SKIPPED')
    .map((result) => result.rule.id);
  return incompleteDependencyRuleIds.length === 0
    ? null
    : createRuleResult(
        rule,
        node,
        'INCOMPLETE',
        [],
        incompleteDependencyRuleIds.map((dependencyRuleId) => ({
          code: 'dependency-incomplete',
          message: `Rule "${rule.identity.id}" depends on incomplete rule "${dependencyRuleId}".`,
          ruleId: rule.identity.id,
        })),
      );
}

/*** Stop execution before a provider runs when its required direct inputs are unavailable. */
function evaluatePrerequisites<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  availableCapabilities: ReadonlySet<string>,
  ruleOptions: JsonValue | undefined,
): RuleResult | null {
  const missingCapabilities = (rule.requiredCapabilities ?? []).filter(
    (capability) => !availableCapabilities.has(capability),
  );
  if (missingCapabilities.length > 0) {
    return createRuleResult(
      rule,
      node,
      'INCOMPLETE',
      [],
      missingCapabilities.map((capability) => ({
        code: 'missing-capability',
        ruleId: rule.identity.id,
        message: `Rule "${rule.identity.id}" requires unavailable capability "${capability}".`,
      })),
    );
  }
  try {
    const optionDiagnostics = rule.validateOptions?.(ruleOptions) ?? [];
    return optionDiagnostics.length === 0
      ? null
      : createRuleResult(
          rule,
          node,
          'ERROR',
          [],
          optionDiagnostics.map((diagnostic) => ({
            code: 'invalid-options',
            ruleId: rule.identity.id,
            message: `Rule "${rule.identity.id}": ${diagnostic.message}`,
          })),
        );
  } catch {
    return createRuleResult(rule, node, 'ERROR', [], [createRuleErrorDiagnostic(rule)]);
  }
}

/*** Create a stable diagnostic when the evaluator catches a provider exception. */
function createRuleErrorDiagnostic<TContext>(rule: Rule<TContext>): RuleResultDiagnostic {
  return {
    code: 'rule-error',
    ruleId: rule.identity.id,
    message: `Rule "${rule.identity.id}" threw while the evaluator invoked it.`,
  };
}

/*** Assemble an immutable serializable result without inferring status from findings. */
function createRuleResult<TContext>(
  rule: Rule<TContext>,
  node: RuleEvaluationPlanNode,
  status: RuleResult['status'],
  findings: readonly RuleFinding[],
  diagnostics: readonly RuleResultDiagnostic[],
): RuleResult {
  return freezeRuleResult({
    diagnostics,
    findings,
    rule: Object.freeze({ ...rule.identity }),
    scope: Object.freeze({ ...node.scope }),
    status,
  });
}

/*** Group plan diagnostics by affected rule for constant-time node evaluation. */
function groupDiagnosticsByRuleId(
  diagnostics: readonly RuleEvaluationDiagnostic[],
): ReadonlyMap<string, readonly RuleEvaluationDiagnostic[]> {
  const grouped = new Map<string, readonly RuleEvaluationDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const existingDiagnostics = grouped.get(diagnostic.ruleId) ?? [];
    grouped.set(diagnostic.ruleId, [...existingDiagnostics, diagnostic]);
  }
  return grouped;
}

/*** Expose per-rule diagnostics through the aggregate result without dropping identity. */
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

/*** Sort aggregate diagnostics by stable rule identifier and diagnostic code. */
function compareDiagnostics(
  left: RuleEvaluationDiagnostic,
  right: RuleEvaluationDiagnostic,
): number {
  return (
    compareRuleEntityIds({ id: left.ruleId }, { id: right.ruleId }) ||
    compareRuleEntityIds({ id: left.code }, { id: right.code })
  );
}
