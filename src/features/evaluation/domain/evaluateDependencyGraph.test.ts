import { expect, test } from 'bun:test';

import {
  createRuleEvaluationPlan,
  evaluateRules,
  type Rule,
  type RuleEvaluationInput,
  type RuleEvaluationOutcome,
} from '../../../index.js';

interface FixtureContext {
  readonly value: string;
}

const fixtureScope = { id: 'fixture', kind: 'fixture' } as const;

test('evaluates a diamond closure once in stable topological order and freezes dependency input', () => {
  const evaluations: string[] = [];
  let dependencyResultsAreFrozen = false;
  const child = createRule('child', [], () => {
    evaluations.push('child');
    return { status: 'PASS', findings: [] };
  });
  const left = createRule('left', ['child'], ({ dependencyResults }) => {
    evaluations.push(`left:${dependencyResults.map((result) => result.rule.id).join(',')}`);
    return { status: 'PASS', findings: [] };
  });
  const right = createRule('right', ['child'], ({ dependencyResults }) => {
    evaluations.push(`right:${dependencyResults.map((result) => result.rule.id).join(',')}`);
    return { status: 'PASS', findings: [] };
  });
  const root = createRule('root', ['right', 'left'], ({ dependencyResults }) => {
    dependencyResultsAreFrozen = Object.isFrozen(dependencyResults);
    evaluations.push(`root:${dependencyResults.map((result) => result.rule.id).join(',')}`);
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules({ value: 'fixture' }, [root, right, child, left], {
    scope: fixtureScope,
    selection: { rootRuleIds: ['root'] },
  });

  expect(evaluations).toEqual(['child', 'left:child', 'right:child', 'root:left,right']);
  expect(dependencyResultsAreFrozen).toBe(true);
  expect(result.results.map((entry) => entry.rule.id)).toEqual(['child', 'left', 'right', 'root']);
  expect(result.plan.nodes.map((node) => [node.rule.id, node.dependencyRuleIds])).toEqual([
    ['child', []],
    ['left', ['child']],
    ['right', ['child']],
    ['root', ['left', 'right']],
  ]);
  expect(JSON.parse(JSON.stringify(result.plan))).toEqual(result.plan);
});

test('isolates deeply immutable child results across diamond parents', () => {
  let rightEvidence: unknown;
  const child = createRule('child', [], () => ({
    status: 'PASS',
    findings: [
      {
        evidence: { nested: { value: 'original' } },
        message: 'Child evidence.',
        ruleId: 'provider-controlled',
        severity: 'info',
        subjects: [{ id: 'subject', kind: 'fixture' }],
      },
    ],
  }));
  const left = createRule('left', ['child'], ({ dependencyResults }) => {
    const childFinding = dependencyResults[0]?.findings[0];
    if (childFinding !== undefined && typeof childFinding.evidence === 'object') {
      Object.defineProperty(childFinding.evidence, 'nested', { value: 'mutated' });
    }
    return { status: 'PASS', findings: [] };
  });
  const right = createRule('right', ['child'], ({ dependencyResults }) => {
    rightEvidence = dependencyResults[0]?.findings[0]?.evidence;
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules({ value: 'fixture' }, [right, left, child], {
    scope: fixtureScope,
  });
  const childResult = result.results.find((entry) => entry.rule.id === 'child');
  const childFinding = childResult?.findings[0];

  expect(result.results.map((entry) => [entry.rule.id, entry.status])).toEqual([
    ['child', 'PASS'],
    ['left', 'ERROR'],
    ['right', 'PASS'],
  ]);
  expect(rightEvidence).toEqual({ nested: { value: 'original' } });
  expect(Object.isFrozen(childResult)).toBe(true);
  expect(Object.isFrozen(childFinding)).toBe(true);
  expect(Object.isFrozen(childFinding?.evidence)).toBe(true);
  expect(Object.isFrozen((childFinding?.evidence as { nested: unknown }).nested)).toBe(true);
  expect(Object.isFrozen(childFinding?.subjects)).toBe(true);
  expect(Object.isFrozen(childFinding?.subjects[0])).toBe(true);
});

test('reports cycles without invoking cyclic providers', () => {
  const evaluations: string[] = [];
  const alpha = createRule('alpha', ['beta'], () => {
    evaluations.push('alpha');
    return { status: 'PASS', findings: [] };
  });
  const beta = createRule('beta', ['alpha'], () => {
    evaluations.push('beta');
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules({ value: 'fixture' }, [beta, alpha], {
    scope: fixtureScope,
    selection: { rootRuleIds: ['alpha'] },
  });

  expect(evaluations).toEqual([]);
  expect(result.results.map((entry) => [entry.rule.id, entry.status])).toEqual([
    ['alpha', 'ERROR'],
    ['beta', 'ERROR'],
  ]);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['cycle', 'cycle']);
});

test('reports every member of overlapping dependency cycles', () => {
  const alpha = createRule('alpha', ['beta', 'gamma'], () => ({ status: 'PASS', findings: [] }));
  const beta = createRule('beta', ['alpha'], () => ({ status: 'PASS', findings: [] }));
  const gamma = createRule('gamma', ['beta'], () => ({ status: 'PASS', findings: [] }));

  const result = evaluateRules({ value: 'fixture' }, [gamma, beta, alpha], {
    scope: fixtureScope,
  });

  expect(result.results.map((entry) => [entry.rule.id, entry.status])).toEqual([
    ['alpha', 'ERROR'],
    ['beta', 'ERROR'],
    ['gamma', 'ERROR'],
  ]);
  expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.ruleId])).toEqual([
    ['cycle', 'alpha'],
    ['cycle', 'beta'],
    ['cycle', 'gamma'],
  ]);
});

test('passes a failed child as evidence without deciding its parent outcome', () => {
  let receivedChildStatus: string | undefined;
  const child = createRule('child', [], () => ({ status: 'FAIL', findings: [] }));
  const parent = createRule('parent', ['child'], ({ dependencyResults }) => {
    receivedChildStatus = dependencyResults[0]?.status;
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules({ value: 'fixture' }, [parent, child], { scope: fixtureScope });

  expect(receivedChildStatus).toBe('FAIL');
  expect(result.results.map((entry) => [entry.rule.id, entry.status])).toEqual([
    ['child', 'FAIL'],
    ['parent', 'PASS'],
  ]);
});

test('reports an unknown child without invoking its parent', () => {
  const evaluations: string[] = [];
  const root = createRule('root', ['missing'], () => {
    evaluations.push('root');
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules({ value: 'fixture' }, [root], {
    scope: fixtureScope,
    selection: { rootRuleIds: ['root'] },
  });

  expect(evaluations).toEqual([]);
  expect(result.results.map((entry) => entry.status)).toEqual(['ERROR']);
  expect(result.diagnostics).toEqual([
    expect.objectContaining({ code: 'missing-dependency', ruleId: 'root' }),
  ]);
});

test('orders independent roots and plan projection deterministically', () => {
  const alpha = createRule('alpha', [], () => ({ status: 'PASS', findings: [] }));
  const zeta = createRule('zeta', [], () => ({ status: 'PASS', findings: [] }));
  const options = { scope: fixtureScope, selection: { rootRuleIds: ['zeta', 'alpha'] } } as const;

  const firstPlan = createRuleEvaluationPlan([zeta, alpha], options);
  const secondPlan = createRuleEvaluationPlan([alpha, zeta], options);
  const result = evaluateRules({ value: 'fixture' }, [zeta, alpha], options);

  expect(firstPlan).toEqual(secondPlan);
  expect(firstPlan.rootRuleIds).toEqual(['alpha', 'zeta']);
  expect(result.results.map((entry) => entry.rule.id)).toEqual(['alpha', 'zeta']);
});

test('propagates incomplete, errored, and disabled children without invoking their parent', () => {
  const evaluations: string[] = [];
  const incompleteChild = createRule('incomplete-child', [], () => ({
    status: 'INCOMPLETE',
    findings: [],
  }));
  const erroredChild = createRule('errored-child', [], () => {
    throw new Error('fixture provider failure');
  });
  const disabledChild = createRule('disabled-child', [], () => {
    evaluations.push('disabled-child');
    return { status: 'PASS', findings: [] };
  });
  const incompleteParent = createRule('incomplete-parent', ['incomplete-child'], () => {
    evaluations.push('incomplete-parent');
    return { status: 'PASS', findings: [] };
  });
  const erroredParent = createRule('errored-parent', ['errored-child'], () => {
    evaluations.push('errored-parent');
    return { status: 'PASS', findings: [] };
  });
  const disabledParent = createRule('disabled-parent', ['disabled-child'], () => {
    evaluations.push('disabled-parent');
    return { status: 'PASS', findings: [] };
  });

  const result = evaluateRules(
    { value: 'fixture' },
    [disabledParent, erroredParent, incompleteParent, disabledChild, erroredChild, incompleteChild],
    {
      disabledRuleIds: ['disabled-child'],
      scope: fixtureScope,
    },
  );

  expect(evaluations).toEqual([]);
  expect(result.results.map((entry) => [entry.rule.id, entry.status])).toEqual([
    ['disabled-child', 'INCOMPLETE'],
    ['disabled-parent', 'INCOMPLETE'],
    ['errored-child', 'ERROR'],
    ['errored-parent', 'ERROR'],
    ['incomplete-child', 'INCOMPLETE'],
    ['incomplete-parent', 'INCOMPLETE'],
  ]);
  expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'disabled-dependency',
    'dependency-incomplete',
    'rule-error',
    'dependency-error',
    'dependency-incomplete',
  ]);
});

function createRule(
  id: string,
  dependencyRuleIds: readonly string[],
  evaluate: (input: RuleEvaluationInput<FixtureContext>) => RuleEvaluationOutcome,
): Rule<FixtureContext> {
  return {
    defaultSeverity: 'info',
    dependencies: dependencyRuleIds.map((ruleId) => ({ ruleId })),
    evaluate,
    identity: { id, version: '1.0.0' },
    summary: id,
  };
}
