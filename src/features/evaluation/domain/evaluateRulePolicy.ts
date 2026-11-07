import type {
  EvaluateRulePolicyOptions,
  RuleEvaluationPlanNode,
  RulePolicyDiagnostic,
  RulePolicyProfile,
  RulePolicyProfileReport,
  RulePolicyReport,
  RuleResult,
  RuleSeverity,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';

/*** Apply central Required and advisory profiles to a completed deterministic Rules evaluation. */
export function evaluateRulePolicy(options: EvaluateRulePolicyOptions): RulePolicyReport {
  const profiles = [...options.policy.profiles]
    .sort(compareProfiles)
    .map((profile) => evaluateProfile(profile, options));
  return {
    decision: profiles.some((profile) => profile.decision === 'BLOCK') ? 'FAIL' : 'PASS',
    profiles: Object.freeze(profiles),
    provenance: Object.freeze({ ...options.provenance }),
  };
}

/*** Evaluate the complete dependency closure of one profile without allowing repository configuration to alter its roots. */
function evaluateProfile(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
): RulePolicyProfileReport {
  const closure = collectDependencyClosure(profile.rootRuleIds, options.evaluation.plan.nodes);
  const diagnostics = createProfileDiagnostics(profile, options, closure);
  const results = selectProfileResults(options.evaluation.results, closure.nodes);
  const shouldBlock =
    profile.mode === 'required' &&
    (diagnostics.length > 0 || results.some((result) => isBlockingResult(result, profile)));
  return {
    decision: shouldBlock ? 'BLOCK' : profile.mode === 'advisory' ? 'ADVISORY' : 'PASS',
    diagnostics: Object.freeze(diagnostics),
    profile: Object.freeze({
      ...profile,
      rootRuleIds: Object.freeze([...profile.rootRuleIds].sort(compareStrings)),
    }),
    results: Object.freeze(results),
  };
}

/*** Establish the complete evidence set that a Required profile needs before it can pass. */
function createProfileDiagnostics(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
  closure: RequiredDependencyClosure,
): readonly RulePolicyDiagnostic[] {
  if (profile.mode !== 'required') return [];
  return [
    ...createRootDiagnostics(profile, options),
    ...createMissingPlanNodeDiagnostics(profile, closure.missingRuleIds),
    ...createResultDiagnostics(profile, options.evaluation.results, closure.nodes),
    ...createEvaluationDiagnostics(profile, options, closure.nodes),
  ].sort(comparePolicyDiagnostics);
}

/*** Detect absent or unselected Required roots before interpreting provider-owned result statuses. */
function createRootDiagnostics(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
): readonly RulePolicyDiagnostic[] {
  const selectedRootIds = new Set(options.evaluation.plan.rootRuleIds);
  const nodesByRuleId = new Map(
    options.evaluation.plan.nodes.map((node) => [node.rule.id, node] as const),
  );
  return [...new Set(profile.rootRuleIds)].sort(compareStrings).flatMap((ruleId) => {
    if (!selectedRootIds.has(ruleId)) {
      return [createPolicyDiagnostic('required-root-not-selected', profile, ruleId)];
    }
    return nodesByRuleId.has(ruleId)
      ? []
      : [createPolicyDiagnostic('missing-required-root', profile, ruleId)];
  });
}

/*** Require every dependency edge in a Required plan closure to resolve to a plan node. */
function createMissingPlanNodeDiagnostics(
  profile: RulePolicyProfile,
  missingRuleIds: ReadonlySet<string>,
): readonly RulePolicyDiagnostic[] {
  return [...missingRuleIds]
    .sort(compareStrings)
    .map((ruleId) => createPolicyDiagnostic('missing-required-plan-node', profile, ruleId));
}

/*** Require exactly one complete result that matches every planned member of the Required closure. */
function createResultDiagnostics(
  profile: RulePolicyProfile,
  results: readonly RuleResult[],
  closure: ReadonlyMap<string, RuleEvaluationPlanNode>,
): readonly RulePolicyDiagnostic[] {
  return [...closure.values()].flatMap((node) => {
    const matchingResults = results.filter((result) => matchesPlanNode(result, node));
    if (matchingResults.length === 0) {
      return [createPolicyDiagnostic('missing-required-result', profile, node.rule.id)];
    }
    if (matchingResults.length > 1) {
      return [createPolicyDiagnostic('ambiguous-required-result', profile, node.rule.id)];
    }
    const [result] = matchingResults;
    return result !== undefined && isCompleteResult(result)
      ? []
      : [createPolicyDiagnostic('incomplete-required-result', profile, node.rule.id)];
  });
}

/*** Block a Required decision when evaluator or planner evidence says a closure member was not trustworthy. */
function createEvaluationDiagnostics(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
  closure: ReadonlyMap<string, RuleEvaluationPlanNode>,
): readonly RulePolicyDiagnostic[] {
  const diagnostics = [...options.evaluation.plan.diagnostics, ...options.evaluation.diagnostics];
  const identities = new Set<string>();
  return diagnostics
    .filter((diagnostic) => closure.has(diagnostic.ruleId))
    .sort(compareEvaluationDiagnostics)
    .flatMap((diagnostic) => {
      const identity = JSON.stringify([diagnostic.code, diagnostic.message, diagnostic.ruleId]);
      if (identities.has(identity)) return [];
      identities.add(identity);
      return [
        createPolicyDiagnostic(
          'required-evaluation-diagnostic',
          profile,
          diagnostic.ruleId,
          diagnostic.message,
        ),
      ];
    });
}

/*** Construct a stable policy diagnostic without borrowing provider-specific error codes. */
function createPolicyDiagnostic(
  code: RulePolicyDiagnostic['code'],
  profile: RulePolicyProfile,
  ruleId: string,
  cause?: string,
): RulePolicyDiagnostic {
  return {
    code,
    message: createPolicyDiagnosticMessage(code, profile.id, ruleId, cause),
    profile: { id: profile.id, version: profile.version },
    ruleId,
  };
}

/*** Describe policy-owned failures without conflating them with provider diagnostics. */
function createPolicyDiagnosticMessage(
  code: RulePolicyDiagnostic['code'],
  profileId: string,
  ruleId: string,
  cause: string | undefined,
): string {
  if (code === 'required-root-not-selected') {
    return `Required profile "${profileId}" must select root rule "${ruleId}".`;
  }
  if (code === 'missing-required-root') {
    return `Required profile "${profileId}" could not resolve root rule "${ruleId}".`;
  }
  if (code === 'missing-required-plan-node') {
    return `Required profile "${profileId}" has no plan node for dependency rule "${ruleId}".`;
  }
  if (code === 'missing-required-result') {
    return `Required profile "${profileId}" has no result for planned rule "${ruleId}".`;
  }
  if (code === 'ambiguous-required-result') {
    return `Required profile "${profileId}" has multiple results for planned rule "${ruleId}".`;
  }
  if (code === 'incomplete-required-result') {
    return `Required profile "${profileId}" has no complete result for planned rule "${ruleId}".`;
  }
  return `Required profile "${profileId}" cannot trust rule "${ruleId}": ${cause ?? 'unknown evaluator diagnostic'}`;
}

/*** Select matching planned results in deterministic plan order for the profile report. */
function selectProfileResults(
  results: readonly RuleResult[],
  closure: ReadonlyMap<string, RuleEvaluationPlanNode>,
): readonly RuleResult[] {
  return [...closure.values()]
    .sort((left, right) => compareStrings(left.rule.id, right.rule.id))
    .flatMap((node) => results.filter((result) => matchesPlanNode(result, node)));
}

/*** Traverse only evaluator-owned plan edges so policy interpretation cannot cause a second rule execution. */
function collectDependencyClosure(
  rootRuleIds: readonly string[],
  planNodes: readonly RuleEvaluationPlanNode[],
): RequiredDependencyClosure {
  const nodesByRuleId = new Map(planNodes.map((node) => [node.rule.id, node] as const));
  const rootRuleIdSet = new Set(rootRuleIds);
  const pendingRuleIds = [...rootRuleIds];
  const selectedNodesByRuleId = new Map<string, RuleEvaluationPlanNode>();
  const missingRuleIds = new Set<string>();
  for (const ruleId of pendingRuleIds) {
    if (selectedNodesByRuleId.has(ruleId)) continue;
    const node = nodesByRuleId.get(ruleId);
    if (node === undefined) {
      if (!rootRuleIdSet.has(ruleId)) missingRuleIds.add(ruleId);
      continue;
    }
    selectedNodesByRuleId.set(ruleId, node);
    pendingRuleIds.push(...node.dependencyRuleIds);
  }
  return { missingRuleIds, nodes: selectedNodesByRuleId };
}

type RequiredDependencyClosure = Readonly<{
  readonly missingRuleIds: ReadonlySet<string>;
  readonly nodes: ReadonlyMap<string, RuleEvaluationPlanNode>;
}>;

/*** Match portable result identity and scope to the exact node that the evaluator planned. */
function matchesPlanNode(result: RuleResult, node: RuleEvaluationPlanNode): boolean {
  return (
    result.rule.id === node.rule.id &&
    result.rule.version === node.rule.version &&
    result.scope.id === node.scope.id &&
    result.scope.kind === node.scope.kind
  );
}

/*** Treat only PASS and threshold-evaluated FAIL states as completed execution evidence. */
function isCompleteResult(result: RuleResult): boolean {
  return result.status === 'PASS' || result.status === 'FAIL';
}

/*** Fail closed for incomplete execution and only block findings at the profile's declared severity threshold. */
function isBlockingResult(result: RuleResult, profile: RulePolicyProfile): boolean {
  if (result.status === 'ERROR' || result.status === 'INCOMPLETE' || result.status === 'SKIPPED') {
    return true;
  }
  return (
    result.status === 'FAIL' &&
    result.findings.some((finding) => {
      return compareSeverity(finding.severity, profile.severityThreshold) >= 0;
    })
  );
}

/*** Order severities by blocking impact without relying on locale-specific string comparison. */
function compareSeverity(left: RuleSeverity, right: RuleSeverity): number {
  return severityRank(left) - severityRank(right);
}

/*** Assign the policy ordering used by every Required profile severity threshold. */
function severityRank(severity: RuleSeverity): number {
  return severity === 'error' ? 2 : severity === 'warning' ? 1 : 0;
}

/*** Sort profile reports into a stable wire representation regardless of caller array order. */
function compareProfiles(left: RulePolicyProfile, right: RulePolicyProfile): number {
  return compareStrings(left.id, right.id) || compareStrings(left.version, right.version);
}

/*** Keep policy diagnostics stable regardless of evaluator input ordering. */
function comparePolicyDiagnostics(left: RulePolicyDiagnostic, right: RulePolicyDiagnostic): number {
  return (
    compareStrings(left.ruleId, right.ruleId) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.message, right.message)
  );
}

/*** Keep evaluator diagnostic interpretation stable before creating policy report entries. */
function compareEvaluationDiagnostics(
  left: { readonly code: string; readonly message: string; readonly ruleId: string },
  right: { readonly code: string; readonly message: string; readonly ruleId: string },
): number {
  return (
    compareStrings(left.ruleId, right.ruleId) ||
    compareStrings(left.code, right.code) ||
    compareStrings(left.message, right.message)
  );
}

/*** Compare policy identities with the evaluator's canonical code-unit order. */
function compareStrings(left: string, right: string): number {
  return compareRuleEntityIds({ id: left }, { id: right });
}
