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
  const diagnostics = createRootDiagnostics(profile, options);
  const results = selectProfileResults(profile, options);
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

/*** Detect absent or unselected Required roots before interpreting provider-owned result statuses. */
function createRootDiagnostics(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
): readonly RulePolicyDiagnostic[] {
  if (profile.mode !== 'required') return [];
  const resultIds = new Set(options.evaluation.results.map((result) => result.rule.id));
  const selectedRootIds = new Set(options.evaluation.plan.rootRuleIds);
  return [...new Set(profile.rootRuleIds)].sort(compareStrings).flatMap((ruleId) => {
    if (!selectedRootIds.has(ruleId)) {
      return [createPolicyDiagnostic('required-root-not-selected', profile, ruleId)];
    }
    return resultIds.has(ruleId)
      ? []
      : [createPolicyDiagnostic('missing-required-root', profile, ruleId)];
  });
}

/*** Construct a stable policy diagnostic without borrowing provider-specific error codes. */
function createPolicyDiagnostic(
  code: RulePolicyDiagnostic['code'],
  profile: RulePolicyProfile,
  ruleId: string,
): RulePolicyDiagnostic {
  return {
    code,
    message:
      code === 'required-root-not-selected'
        ? `Required profile "${profile.id}" must select root rule "${ruleId}".`
        : `Required profile "${profile.id}" could not resolve root rule "${ruleId}".`,
    profile: { id: profile.id, version: profile.version },
    ruleId,
  };
}

/*** Select every scoped result in the dependency closure of a profile's explicitly named roots. */
function selectProfileResults(
  profile: RulePolicyProfile,
  options: EvaluateRulePolicyOptions,
): readonly RuleResult[] {
  const nodesByRuleId = new Map(
    options.evaluation.plan.nodes.map((node) => [node.rule.id, node] as const),
  );
  const resultByRuleId = new Map(
    options.evaluation.results.map((result) => [result.rule.id, result] as const),
  );
  const selectedRuleIds = collectDependencyClosure(profile.rootRuleIds, nodesByRuleId);
  return [...selectedRuleIds].sort(compareStrings).flatMap((ruleId) => {
    const result = resultByRuleId.get(ruleId);
    return result === undefined ? [] : [result];
  });
}

/*** Traverse only evaluator-owned plan edges so policy interpretation cannot cause a second rule execution. */
function collectDependencyClosure(
  rootRuleIds: readonly string[],
  nodesByRuleId: ReadonlyMap<string, RuleEvaluationPlanNode>,
): ReadonlySet<string> {
  const pendingRuleIds = [...rootRuleIds];
  const selectedRuleIds = new Set<string>();
  for (const ruleId of pendingRuleIds) {
    if (selectedRuleIds.has(ruleId)) continue;
    selectedRuleIds.add(ruleId);
    const node = nodesByRuleId.get(ruleId);
    if (node !== undefined) pendingRuleIds.push(...node.dependencyRuleIds);
  }
  return selectedRuleIds;
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

/*** Compare policy identities with the evaluator's canonical code-unit order. */
function compareStrings(left: string, right: string): number {
  return compareRuleEntityIds({ id: left }, { id: right });
}
