import type { Rule, RuleRegistry, RuleSet } from './types/rules.js';

/*** Create a deterministic registry from independently owned RuleSets. */
export function createRuleRegistry<TContext>(
  ruleSets: readonly RuleSet<TContext>[],
): RuleRegistry<TContext> {
  const sortedRuleSets = [...ruleSets].sort((left, right) => left.id.localeCompare(right.id));
  assertUniqueRuleSetIds(sortedRuleSets);
  const rules = sortedRuleSets
    .flatMap((ruleSet) => ruleSet.rules)
    .sort((left, right) => left.id.localeCompare(right.id));
  assertUniqueRuleIds(rules);

  return {
    ruleSets: sortedRuleSets,
    rules,
    ruleById: new Map(rules.map((rule) => [rule.id, rule])),
  };
}

/*** Reject ambiguous provider composition before evaluating a registry. */
function assertUniqueRuleSetIds<TContext>(ruleSets: readonly RuleSet<TContext>[]): void {
  const duplicateId = findDuplicateId(ruleSets.map((ruleSet) => ruleSet.id));
  if (duplicateId !== null) throw new Error(`Duplicate RuleSet ID: ${duplicateId}`);
}

/*** Reject multiple providers that claim the same public rule identifier. */
function assertUniqueRuleIds<TContext>(rules: readonly Rule<TContext>[]): void {
  const duplicateId = findDuplicateId(rules.map((rule) => rule.id));
  if (duplicateId !== null) throw new Error(`Duplicate rule ID: ${duplicateId}`);
}

/*** Find the first duplicate in an already deterministic sequence of identifiers. */
function findDuplicateId(ids: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return id;
    seen.add(id);
  }
  return null;
}
