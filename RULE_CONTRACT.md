# Composable rule contract

This document freezes the Wave W0 public contract. It deliberately defines data and semantics only;
the dependency-DAG planner and executor are owned by Rules issue #15.

## Identity, scope, and selection

- A rule has a stable `RuleIdentity` of `id` and immutable semantic `version`.
- A result belongs to one `RuleScope` (`kind`, `id`). Host tenant, project authorization, storage,
  caching, and lifecycle identity are not core-rule inputs.
- Callers that have no narrower target may omit scope and receive the stable global scope
  (`global`/`global`); hosts with semantic targets must supply their exact scope.
- `RuleSelection.rootRuleIds` is owned by the caller. It identifies requested roots only. It never
  changes a rule's declared dependencies.
- A dependency is a stable `ruleId`, declared on `Rule.dependencies`. The evaluator resolves the
  transitive closure, detects duplicate IDs and cycles, and invokes each scoped rule instance once.
  Rules do not call child rules. `createRuleEvaluationPlan` exposes the resolved roots, ordered
  nodes, and dependency edges as a serializable, presentation-neutral graph.

## Evaluation and status

The evaluator supplies a rule with its immutable context, exact scope, options, and precomputed
dependency results. A provider returns only `PASS`, `FAIL`, or `INCOMPLETE` with serializable
findings. The evaluator alone produces `ERROR` for evaluation/resolution failures and `SKIPPED`
for a rule deliberately outside the selected execution.

`PASS` is therefore never inferred merely from an empty finding list: the provider must explicitly
return it. `FAIL` is a completed policy observation, whereas `ERROR` is evaluation failure.
Neither is a CI or policy-gate decision; policy interpretation is a later concern.

## Fail-closed dependency behavior

- Unknown or ambiguous dependency IDs and cycles are evaluator errors.
- A disabled dependency, unavailable capability, incompatible scope, or unavailable evidence is
  incomplete, never a passing result.
- A child `ERROR` or `INCOMPLETE` prevents a dependent rule from being passed as complete unless
  the evaluator has recorded an explicit diagnostic outcome.
- A child `FAIL` is passed to the parent as evidence. It does not automatically decide the
  parent's policy outcome.
- Severity overrides apply to emitted findings after evaluation. They cannot alter rule identity,
  dependencies, status, scope, or evaluator diagnostics.

## Metadata and evidence

`RuleFacet` is a provider-owned `id`/`value` classification pair. It is intentionally generic and
does not encode UI, product, or design-domain taxonomy. `RuleFinding.evidence` remains JSON-only;
providers may compose evidence from their dependency results without losing the source rule result.
