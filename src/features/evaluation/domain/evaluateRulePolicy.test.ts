import { expect, test } from 'bun:test';

import { gate } from '../../../cli/commands/gate.js';
import type {
  Rule,
  RuleEvaluationOutcome,
  RuleEvaluationResult,
  RulePolicy,
  RulePolicyProfile,
  RuleSeverity,
} from '../../../types/rules.js';
import { evaluateRulePolicy } from './evaluateRulePolicy.js';
import { evaluateRules } from './evaluateRules.js';

const fixtureScope = { id: 'fixture-project', kind: 'project' } as const;
const fixtureProvenance = {
  commitSha: 'c0ffee',
  configHash: 'config-hash',
  factsHash: 'facts-hash',
} as const;

test('blocks a Required profile when a selected rule fails at its severity threshold', () => {
  const evaluation = evaluateFixture('release.required', {
    status: 'FAIL',
    findings: [createFinding('error')],
  });

  const report = evaluateRulePolicy({
    evaluation,
    policy: createPolicy('required', ['release.required'], 'warning'),
    provenance: fixtureProvenance,
  });

  expect(report.decision).toBe('FAIL');
  expect(report.profiles[0]).toMatchObject({
    decision: 'BLOCK',
    profile: { id: 'fixture-profile', version: '1.0.0' },
    results: [
      {
        rule: { id: 'release.required', version: '1.0.0' },
        scope: fixtureScope,
        status: 'FAIL',
      },
    ],
  });
  expect(report.provenance).toEqual(fixtureProvenance);
  expect(gate(report)).toEqual({ exitCode: 1, stdout: `${JSON.stringify(report)}\n` });
});

test('fails closed for unknown, incomplete, skipped, and errored Required roots', () => {
  const unknownEvaluation = evaluateRules({}, [], {
    selection: { rootRuleIds: ['missing.required'] },
    scope: fixtureScope,
  });
  const incompleteEvaluation = evaluateFixture('incomplete.required', {
    status: 'INCOMPLETE',
    findings: [],
  });
  const skippedEvaluation = replaceStatus(
    evaluateFixture('skipped.required', { status: 'PASS', findings: [] }),
    'SKIPPED',
  );
  const erroredEvaluation = replaceStatus(
    evaluateFixture('errored.required', { status: 'PASS', findings: [] }),
    'ERROR',
  );

  expect(
    evaluateRulePolicy({
      evaluation: unknownEvaluation,
      policy: createPolicy('required', ['missing.required'], 'error'),
      provenance: fixtureProvenance,
    }),
  ).toMatchObject({
    decision: 'FAIL',
    profiles: [
      {
        decision: 'BLOCK',
        diagnostics: [expect.objectContaining({ code: 'missing-required-root' })],
      },
    ],
  });
  for (const evaluation of [incompleteEvaluation, skippedEvaluation, erroredEvaluation]) {
    expect(
      evaluateRulePolicy({
        evaluation,
        policy: createPolicy('required', [evaluation.plan.rootRuleIds[0] ?? 'missing'], 'error'),
        provenance: fixtureProvenance,
      }).decision,
    ).toBe('FAIL');
  }
});

test('reports advisory failures without blocking CI and honors the profile threshold', () => {
  const evaluation = evaluateFixture(
    'design.heuristic',
    {
      status: 'FAIL',
      findings: [createFinding('info')],
    },
    'info',
  );

  const advisoryReport = evaluateRulePolicy({
    evaluation,
    policy: createPolicy('advisory', ['design.heuristic'], 'info'),
    provenance: fixtureProvenance,
  });
  const thresholdReport = evaluateRulePolicy({
    evaluation,
    policy: createPolicy('required', ['design.heuristic'], 'warning'),
    provenance: fixtureProvenance,
  });

  expect(advisoryReport.decision).toBe('PASS');
  expect(advisoryReport.profiles[0]?.decision).toBe('ADVISORY');
  expect(thresholdReport.decision).toBe('PASS');
  expect(gate(advisoryReport)).toEqual({
    exitCode: 0,
    stdout: `${JSON.stringify(advisoryReport)}\n`,
  });
});

test('rejects a repository evaluation that omitted a centrally required root without mutating policy', () => {
  const policy = Object.freeze({
    profiles: Object.freeze([
      Object.freeze({
        id: 'central-required',
        mode: 'required' as const,
        rootRuleIds: Object.freeze(['central.required']),
        severityThreshold: 'error' as const,
        version: '1.0.0',
      }),
    ]),
  });
  const evaluation = evaluateFixture('repository.optional', { status: 'PASS', findings: [] });

  const report = evaluateRulePolicy({ evaluation, policy, provenance: fixtureProvenance });

  expect(report.decision).toBe('FAIL');
  expect(report.profiles[0]?.diagnostics).toEqual([
    expect.objectContaining({ code: 'required-root-not-selected', ruleId: 'central.required' }),
  ]);
  expect(policy).toEqual({
    profiles: [
      {
        id: 'central-required',
        mode: 'required',
        rootRuleIds: ['central.required'],
        severityThreshold: 'error',
        version: '1.0.0',
      },
    ],
  });
  expect(Object.isFrozen(policy)).toBe(true);
  expect(Object.isFrozen(policy.profiles[0]?.rootRuleIds)).toBe(true);
});

test('fails closed when a Required planned dependency has no matching completed result', () => {
  const evaluation = evaluateRules(
    {},
    [
      createRule('required.child', { status: 'PASS', findings: [] }),
      createRule('required.root', { status: 'PASS', findings: [] }, 'error', ['required.child']),
    ],
    { scope: fixtureScope, selection: { rootRuleIds: ['required.root'] } },
  );
  const [childResult] = evaluation.results;
  if (childResult === undefined)
    throw new Error('Fixture evaluation must contain the child result.');
  const falsePassEvaluation = {
    ...evaluation,
    results: [
      { ...childResult, scope: { id: 'wrong-project', kind: 'project' } },
      ...evaluation.results.slice(1),
    ],
  };

  const report = evaluateRulePolicy({
    evaluation: falsePassEvaluation,
    policy: createPolicy('required', ['required.root'], 'error'),
    provenance: fixtureProvenance,
  });

  expect(report.decision).toBe('FAIL');
  expect(report.profiles[0]).toMatchObject({
    decision: 'BLOCK',
    diagnostics: [
      expect.objectContaining({ code: 'missing-required-result', ruleId: 'required.child' }),
    ],
  });
});

test('fails closed for ambiguous and incomplete Required child results', () => {
  const evaluation = evaluateRequiredDependencyFixture();
  const [childResult] = evaluation.results;
  if (childResult === undefined)
    throw new Error('Fixture evaluation must contain the child result.');

  const ambiguousReport = evaluateRulePolicy({
    evaluation: { ...evaluation, results: [...evaluation.results, childResult] },
    policy: createPolicy('required', ['required.root'], 'error'),
    provenance: fixtureProvenance,
  });
  const incompleteReport = evaluateRulePolicy({
    evaluation: {
      ...evaluation,
      results: [{ ...childResult, status: 'INCOMPLETE' }, ...evaluation.results.slice(1)],
    },
    policy: createPolicy('required', ['required.root'], 'error'),
    provenance: fixtureProvenance,
  });

  expect(ambiguousReport.decision).toBe('FAIL');
  expect(ambiguousReport.profiles[0]?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
    'ambiguous-required-result',
  );
  expect(incompleteReport.decision).toBe('FAIL');
  expect(incompleteReport.profiles[0]?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
    'incomplete-required-result',
  );
});

test('fails closed for a Required planned child diagnostic despite a restored PASS result', () => {
  const evaluation = evaluateRules(
    {},
    [createRule('required.root', { status: 'PASS', findings: [] }, 'error', ['missing.child'])],
    { scope: fixtureScope, selection: { rootRuleIds: ['required.root'] } },
  );
  const [rootResult] = evaluation.results;
  if (rootResult === undefined) throw new Error('Fixture evaluation must contain the root result.');
  const report = evaluateRulePolicy({
    evaluation: {
      ...evaluation,
      results: [{ ...rootResult, diagnostics: [], status: 'PASS' }],
    },
    policy: createPolicy('required', ['required.root'], 'error'),
    provenance: fixtureProvenance,
  });

  expect(report.decision).toBe('FAIL');
  expect(report.profiles[0]?.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
    'required-evaluation-diagnostic',
  );
});

/*** Evaluate a Required root and its successful direct child for false-PASS regressions. */
function evaluateRequiredDependencyFixture(): RuleEvaluationResult {
  return evaluateRules(
    {},
    [
      createRule('required.child', { status: 'PASS', findings: [] }),
      createRule('required.root', { status: 'PASS', findings: [] }, 'error', ['required.child']),
    ],
    { scope: fixtureScope, selection: { rootRuleIds: ['required.root'] } },
  );
}

/*** Evaluate one isolated fixture rule through the public deterministic evaluator. */
function evaluateFixture(
  id: string,
  outcome: RuleEvaluationOutcome,
  defaultSeverity: RuleSeverity = 'error',
): RuleEvaluationResult {
  return evaluateRules({}, [createRule(id, outcome, defaultSeverity)], {
    scope: fixtureScope,
    selection: { rootRuleIds: [id] },
  });
}

/*** Create a minimal provider fixture whose status and findings are controlled by the policy test. */
function createRule(
  id: string,
  outcome: RuleEvaluationOutcome,
  defaultSeverity: RuleSeverity = 'error',
  dependencyRuleIds: readonly string[] = [],
): Rule {
  return {
    defaultSeverity,
    dependencies: dependencyRuleIds.map((ruleId) => ({ ruleId })),
    evaluate: () => outcome,
    identity: { id, version: '1.0.0' },
    summary: id,
  };
}

/*** Create an engine-owned finding with a chosen policy severity. */
function createFinding(severity: 'error' | 'info' | 'warning') {
  return {
    evidence: {},
    message: 'Fixture finding.',
    ruleId: 'provider-controlled',
    severity,
    subjects: [{ id: 'fixture', kind: 'fixture' }],
  } as const;
}

/*** Replace one result status to cover a restored SKIPPED result that the direct evaluator never emits. */
function replaceStatus(
  evaluation: RuleEvaluationResult,
  status: 'ERROR' | 'SKIPPED',
): RuleEvaluationResult {
  const [result] = evaluation.results;
  if (result === undefined) throw new Error('Fixture evaluation must contain one result.');
  return { ...evaluation, results: [{ ...result, status }] };
}

/*** Build a single explicit policy profile for a focused gate assertion. */
function createPolicy(
  mode: RulePolicyProfile['mode'],
  rootRuleIds: readonly string[],
  severityThreshold: RulePolicyProfile['severityThreshold'],
): RulePolicy {
  return {
    profiles: [
      {
        id: 'fixture-profile',
        mode,
        rootRuleIds,
        severityThreshold,
        version: '1.0.0',
      },
    ],
  };
}
