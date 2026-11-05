import { describe, expect, test } from 'bun:test';

import {
  createRuleEvaluationPlan,
  createRuleRegistry,
  evaluateConfiguredRules,
  evaluateRules,
  getRuleExecutionProvenance,
  type Rule,
  type RuleEvaluationCache,
  type RuleEvaluationOutcome,
  type RuleResult,
} from '../../../index.js';

interface FixtureContext {
  readonly value: string;
}

const scope = { id: 'button-1', kind: 'component' } as const;
const cachePartition = { tenantId: 'tenant-a', projectId: 'project-a' } as const;

describe('serialized evaluation trace', () => {
  test('serializes normalized facets and stable shared DAG node identities', testSerializedPlan);
  test(
    'records actual evaluation, verified cache hits, and legacy unknown provenance',
    testProvenance,
  );
  test(
    'invalidates cache entries for fact or rule versions and isolates authenticated partitions',
    testInvalidation,
  );
  test('preserves cache provenance through configured evaluation', testConfiguredProvenance);
  test('preserves PASS, FAIL, INCOMPLETE, and ERROR through JSON serialization', testOutcomes);
});

function testSerializedPlan(): void {
  const child = createFixtureRule('child');
  const left = createFixtureRule('left', ['child']);
  const right = createFixtureRule('right', ['child']);
  const root = createFixtureRule('root', ['left', 'right'], { facets: createFacets() });
  const firstPlan = createRuleEvaluationPlan([root, right, child, left], { scope });
  const secondPlan = createRuleEvaluationPlan([left, child, root, right], { scope });
  expect(firstPlan).toEqual(secondPlan);
  expect(firstPlan.nodes.map((node) => node.id)).toEqual(createNodeIds());
  expect(firstPlan.nodes.at(-1)).toMatchObject({
    dependencyRuleIds: ['left', 'right'],
    facets: [
      { id: 'family', value: 'layout', version: '2' },
      { id: 'kind', value: 'advisory', version: '1.0.0' },
    ],
  });
  expect(JSON.parse(JSON.stringify(firstPlan))).toEqual(firstPlan);
}

function testProvenance(): void {
  const cache = createMemoryCache();
  let evaluations = 0;
  const rule = createFixtureRule('rule', [], {
    evaluate: () => evaluateOnce(() => (evaluations += 1)),
  });
  const first = evaluateWithCache(rule, cache, { factsVersion: 'facts-1' });
  const second = evaluateWithCache(rule, cache, { factsVersion: 'facts-1' });
  const legacy = { ...first.results[0], execution: undefined } as RuleResult;
  expect(evaluations).toBe(1);
  expect(first.results[0]?.execution).toBe('evaluated');
  expect(second.results[0]?.execution).toBe('cache-hit');
  expect(getRuleExecutionProvenance(legacy)).toBe('unknown');
}

function testInvalidation(): void {
  const cache = createMemoryCache();
  let evaluations = 0;
  const evaluate = () => evaluateOnce(() => (evaluations += 1));
  const firstRule = createFixtureRule('rule', [], { evaluate });
  const nextRuleVersion = createFixtureRule('rule', [], { evaluate, version: '2.0.0' });
  evaluateWithCache(firstRule, cache, { factsVersion: 'facts-1' });
  evaluateWithCache(firstRule, cache, { factsVersion: 'facts-2' });
  evaluateWithCache(nextRuleVersion, cache, { factsVersion: 'facts-2' });
  evaluateWithCache(firstRule, cache, {
    factsVersion: 'facts-2',
    cachePartition: { tenantId: 'tenant-b', projectId: 'project-a' },
  });
  expect(evaluations).toBe(4);
}

function testConfiguredProvenance(): void {
  const cache = createMemoryCache();
  const rule = createFixtureRule('configured');
  const config = { rules: [{ enabled: true, id: rule.identity.id }], version: 1 } as const;
  const options = {
    cache,
    cachePartition,
    factsVersion: 'facts-1',
    scope,
  };

  const first = evaluateConfiguredRules(
    { value: 'fixture' },
    config,
    createRuleRegistry([{ id: 'fixture', rules: [rule] }]),
    options,
  );
  const second = evaluateConfiguredRules(
    { value: 'fixture' },
    config,
    createRuleRegistry([{ id: 'fixture', rules: [rule] }]),
    options,
  );

  expect(first.results[0]?.execution).toBe('evaluated');
  expect(second.results[0]?.execution).toBe('cache-hit');
}

function testOutcomes(): void {
  const passing = createFixtureRule('passing');
  const failing = createFixtureRule('failing', [], { status: 'FAIL' });
  const incomplete = createFixtureRule('incomplete', [], { status: 'INCOMPLETE' });
  const erroring = createFixtureRule('erroring', [], { evaluate: throwEvaluationError });
  const result = evaluateRules({ value: 'fixture' }, [erroring, incomplete, failing, passing], {
    scope,
  });
  expect(result.results.map((entry) => [entry.rule.id, entry.status, entry.execution])).toEqual([
    ['erroring', 'ERROR', 'evaluated'],
    ['failing', 'FAIL', 'evaluated'],
    ['incomplete', 'INCOMPLETE', 'evaluated'],
    ['passing', 'PASS', 'evaluated'],
  ]);
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
}

function createFacets() {
  return [
    { id: 'family', value: 'layout', version: '2' },
    { id: 'kind', value: 'advisory' },
    { id: 'family', value: 'layout', version: '2' },
  ] as const;
}

function createNodeIds(): string[] {
  return [
    '["child","1.0.0","component","button-1"]',
    '["left","1.0.0","component","button-1"]',
    '["right","1.0.0","component","button-1"]',
    '["root","1.0.0","component","button-1"]',
  ];
}

function evaluateOnce(increment: () => number): RuleEvaluationOutcome {
  increment();
  return { status: 'PASS', findings: [] };
}

function throwEvaluationError(): RuleEvaluationOutcome {
  throw new Error('error');
}

function evaluateWithCache(
  rule: Rule<FixtureContext>,
  cache: RuleEvaluationCache,
  options: {
    readonly cachePartition?: { readonly projectId: string; readonly tenantId: string };
    readonly factsVersion: string;
  },
) {
  return evaluateRules({ value: 'fixture' }, [rule], {
    cache,
    cachePartition: options.cachePartition ?? cachePartition,
    factsVersion: options.factsVersion,
    scope,
  });
}

function createMemoryCache(): RuleEvaluationCache {
  const entries = new Map<string, RuleResult>();
  return {
    read: (key) => entries.get(JSON.stringify(key)),
    write: (key, result) => entries.set(JSON.stringify(key), result),
  };
}

function createFixtureRule(
  id: string,
  dependencyRuleIds: readonly string[] = [],
  overrides: Partial<Rule<FixtureContext>> & {
    readonly status?: RuleEvaluationOutcome['status'];
    readonly version?: string;
  } = {},
): Rule<FixtureContext> {
  return {
    defaultSeverity: 'info',
    dependencies: dependencyRuleIds.map((ruleId) => ({ ruleId })),
    evaluate: overrides.evaluate ?? (() => ({ status: overrides.status ?? 'PASS', findings: [] })),
    facets: overrides.facets,
    identity: { id, version: overrides.version ?? '1.0.0' },
    summary: id,
  };
}
