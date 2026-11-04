import type {
  EvaluateRulesOptions,
  Rule,
  RuleEvaluationDiagnostic,
  RuleEvaluationPlan,
  RuleEvaluationPlanNode,
  RuleScope,
} from '../../../types/rules.js';
import { compareRuleEntityIds } from '../../../utils/compareRuleEntityIds.js';

const defaultRuleScope = { id: 'global', kind: 'global' } as const;

/*** Project selected Rules and their complete dependency closure into a deterministic serializable graph. */
export function createRuleEvaluationPlan<TContext>(
  rules: readonly Rule<TContext>[],
  options: Pick<EvaluateRulesOptions, 'scope' | 'selection'> = {},
): RuleEvaluationPlan {
  const scope = options.scope ?? defaultRuleScope;
  const rulesById = groupRulesById(rules);
  const rootRuleIds = resolveRootRuleIds(rulesById, options.selection?.rootRuleIds);
  const closure = resolveDependencyClosure(rootRuleIds, rulesById);
  const nodesById = new Map(
    closure.ruleIds.flatMap((ruleId) => {
      const rule = resolveRule(ruleId, rulesById);
      return rule === null ? [] : [[ruleId, createPlanNode(rule, scope)] as const];
    }),
  );
  const cycleRuleIds = findCycleRuleIds(nodesById);
  const nodes = orderPlanNodes(nodesById, cycleRuleIds);

  return {
    diagnostics: [...closure.diagnostics, ...createCycleDiagnostics(cycleRuleIds)].sort(
      compareDiagnostics,
    ),
    nodes,
    rootRuleIds,
  };
}

/*** Group supplied providers by stable ID so ambiguity remains visible to the plan. */
function groupRulesById<TContext>(
  rules: readonly Rule<TContext>[],
): ReadonlyMap<string, readonly Rule<TContext>[]> {
  const grouped = new Map<string, readonly Rule<TContext>[]>();
  for (const rule of rules) {
    const existingRules = grouped.get(rule.identity.id) ?? [];
    grouped.set(rule.identity.id, [...existingRules, rule]);
  }
  return grouped;
}

/*** Use every supplied rule as a root unless the caller explicitly narrows the run. */
function resolveRootRuleIds<TContext>(
  rulesById: ReadonlyMap<string, readonly Rule<TContext>[]>,
  selectedRootRuleIds: readonly string[] | undefined,
): readonly string[] {
  return [...new Set(selectedRootRuleIds ?? rulesById.keys())].sort(compareStrings);
}

/*** Resolve a stable rule ID only when exactly one provider defines it. */
function resolveRule<TContext>(
  ruleId: string,
  rulesById: ReadonlyMap<string, readonly Rule<TContext>[]>,
): Rule<TContext> | null {
  const matches = rulesById.get(ruleId) ?? [];
  return matches.length === 1 ? (matches[0] ?? null) : null;
}

/*** Discover the selected transitive closure without executing provider code. */
function resolveDependencyClosure<TContext>(
  rootRuleIds: readonly string[],
  rulesById: ReadonlyMap<string, readonly Rule<TContext>[]>,
): {
  readonly diagnostics: readonly RuleEvaluationDiagnostic[];
  readonly ruleIds: readonly string[];
} {
  const pendingRuleIds = [...rootRuleIds];
  const visitedRuleIds = new Set<string>();
  const diagnostics: RuleEvaluationDiagnostic[] = [];

  for (const ruleId of pendingRuleIds) {
    if (visitedRuleIds.has(ruleId)) continue;
    visitedRuleIds.add(ruleId);
    const matches = rulesById.get(ruleId) ?? [];
    if (matches.length === 0) {
      diagnostics.push(createMissingRuleDiagnostic(ruleId, rootRuleIds.includes(ruleId)));
      continue;
    }
    if (matches.length > 1) {
      diagnostics.push(createAmbiguousRuleDiagnostic(ruleId));
      continue;
    }
    const [rule] = matches;
    if (rule === undefined) continue;
    const dependencyRuleIds = [
      ...new Set(rule.dependencies.map((dependency) => dependency.ruleId)),
    ].sort(compareStrings);
    for (const dependencyRuleId of dependencyRuleIds) {
      const dependencyMatches = rulesById.get(dependencyRuleId) ?? [];
      if (dependencyMatches.length === 0) {
        diagnostics.push(createMissingDependencyDiagnostic(rule.identity.id, dependencyRuleId));
      } else if (dependencyMatches.length > 1) {
        diagnostics.push(createAmbiguousDependencyDiagnostic(rule.identity.id, dependencyRuleId));
      } else {
        pendingRuleIds.push(dependencyRuleId);
      }
    }
  }

  return { diagnostics, ruleIds: [...visitedRuleIds].sort(compareStrings) };
}

/*** Create the serializable graph node for one uniquely resolved provider rule. */
function createPlanNode<TContext>(rule: Rule<TContext>, scope: RuleScope): RuleEvaluationPlanNode {
  return {
    dependencyRuleIds: [...new Set(rule.dependencies.map((dependency) => dependency.ruleId))].sort(
      compareStrings,
    ),
    rule: rule.identity,
    scope,
  };
}

/*** Identify only cyclic nodes so dependent nodes are not misreported as cycle members. */
function findCycleRuleIds(
  nodesById: ReadonlyMap<string, RuleEvaluationPlanNode>,
): ReadonlySet<string> {
  const visitingRuleIds = new Set<string>();
  const visitedRuleIds = new Set<string>();
  const cyclicRuleIds = new Set<string>();
  const traversal = (ruleId: string, path: readonly string[]): void => {
    if (visitingRuleIds.has(ruleId)) {
      const cycleStart = path.indexOf(ruleId);
      for (const cyclicRuleId of path.slice(cycleStart)) cyclicRuleIds.add(cyclicRuleId);
      return;
    }
    if (visitedRuleIds.has(ruleId)) return;
    visitingRuleIds.add(ruleId);
    const node = nodesById.get(ruleId);
    for (const dependencyRuleId of node?.dependencyRuleIds ?? []) {
      if (nodesById.has(dependencyRuleId)) traversal(dependencyRuleId, [...path, ruleId]);
    }
    visitingRuleIds.delete(ruleId);
    visitedRuleIds.add(ruleId);
  };

  for (const ruleId of [...nodesById.keys()].sort(compareStrings)) traversal(ruleId, []);
  return cyclicRuleIds;
}

/*** Return a stable child-before-parent ordering for every acyclic node in the plan. */
function orderPlanNodes(
  nodesById: ReadonlyMap<string, RuleEvaluationPlanNode>,
  cycleRuleIds: ReadonlySet<string>,
): readonly RuleEvaluationPlanNode[] {
  const acyclicRuleIds = [...nodesById.keys()].filter((ruleId) => !cycleRuleIds.has(ruleId));
  const unresolvedDependencyCounts = new Map(
    acyclicRuleIds.map((ruleId) => [
      ruleId,
      (nodesById.get(ruleId)?.dependencyRuleIds ?? []).filter(
        (dependencyRuleId) =>
          nodesById.has(dependencyRuleId) && !cycleRuleIds.has(dependencyRuleId),
      ).length,
    ]),
  );
  const dependentsByRuleId = new Map<string, readonly string[]>();
  for (const ruleId of acyclicRuleIds) {
    for (const dependencyRuleId of nodesById.get(ruleId)?.dependencyRuleIds ?? []) {
      if (!unresolvedDependencyCounts.has(dependencyRuleId)) continue;
      const dependents = dependentsByRuleId.get(dependencyRuleId) ?? [];
      dependentsByRuleId.set(dependencyRuleId, [...dependents, ruleId]);
    }
  }
  const readyRuleIds = acyclicRuleIds
    .filter((ruleId) => unresolvedDependencyCounts.get(ruleId) === 0)
    .sort(compareStrings);
  const orderedRuleIds: string[] = [];
  while (readyRuleIds.length > 0) {
    const ruleId = readyRuleIds.shift();
    if (ruleId === undefined) continue;
    orderedRuleIds.push(ruleId);
    for (const dependentRuleId of dependentsByRuleId.get(ruleId) ?? []) {
      const remainingDependencies = (unresolvedDependencyCounts.get(dependentRuleId) ?? 0) - 1;
      unresolvedDependencyCounts.set(dependentRuleId, remainingDependencies);
      if (remainingDependencies === 0) {
        readyRuleIds.push(dependentRuleId);
        readyRuleIds.sort(compareStrings);
      }
    }
  }
  const residualRuleIds = [...nodesById.keys()]
    .filter((ruleId) => !orderedRuleIds.includes(ruleId))
    .sort(compareStrings);
  return [...orderedRuleIds, ...residualRuleIds].flatMap((ruleId) => {
    const node = nodesById.get(ruleId);
    return node === undefined ? [] : [node];
  });
}

/*** Describe an unknown root or child rule without treating it as a provider finding. */
function createMissingRuleDiagnostic(ruleId: string, isRoot: boolean): RuleEvaluationDiagnostic {
  return {
    code: isRoot ? 'unknown-rule' : 'missing-dependency',
    message: isRoot
      ? `Selected rule "${ruleId}" is not registered.`
      : `Rule dependency "${ruleId}" is not registered.`,
    ruleId,
  };
}

/*** Describe an unknown child on the provider that declared it. */
function createMissingDependencyDiagnostic(
  ruleId: string,
  dependencyRuleId: string,
): RuleEvaluationDiagnostic {
  return {
    code: 'missing-dependency',
    message: `Rule "${ruleId}" depends on unknown rule "${dependencyRuleId}".`,
    ruleId,
  };
}

/*** Describe an ambiguous selected root. */
function createAmbiguousRuleDiagnostic(ruleId: string): RuleEvaluationDiagnostic {
  return {
    code: 'ambiguous-rule-id',
    message: `Rule ID "${ruleId}" is provided more than once.`,
    ruleId,
  };
}

/*** Describe an ambiguous child on the provider that declared it. */
function createAmbiguousDependencyDiagnostic(
  ruleId: string,
  dependencyRuleId: string,
): RuleEvaluationDiagnostic {
  return {
    code: 'ambiguous-rule-id',
    message: `Rule "${ruleId}" depends on ambiguous rule ID "${dependencyRuleId}".`,
    ruleId,
  };
}

/*** Emit a deterministic error for every provider that participates in a dependency cycle. */
function createCycleDiagnostics(
  cycleRuleIds: ReadonlySet<string>,
): readonly RuleEvaluationDiagnostic[] {
  return [...cycleRuleIds].sort(compareStrings).map((ruleId) => ({
    code: 'cycle',
    message: `Rule "${ruleId}" participates in a dependency cycle.`,
    ruleId,
  }));
}

/*** Sort diagnostics by their affected rule and then their stable code. */
function compareDiagnostics(
  left: RuleEvaluationDiagnostic,
  right: RuleEvaluationDiagnostic,
): number {
  return compareStrings(left.ruleId, right.ruleId) || compareStrings(left.code, right.code);
}

/*** Compare identifiers without locale-dependent ordering. */
function compareStrings(left: string, right: string): number {
  return compareRuleEntityIds({ id: left }, { id: right });
}
