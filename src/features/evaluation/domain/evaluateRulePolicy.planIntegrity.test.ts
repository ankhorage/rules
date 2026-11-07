import { expect, test } from 'bun:test';

import type { Rule, RulePolicy } from '../../../types/rules.js';
import { evaluateRulePolicy } from './evaluateRulePolicy.js';
import { evaluateRules } from './evaluateRules.js';

const scope = { id: 'fixture-project', kind: 'project' } as const;
const provenance = {
  commitSha: 'c0ffee',
  configHash: 'config-hash',
  factsHash: 'facts-hash',
} as const;

test('fails closed when a Required planned dependency has no plan node without diagnostics', () => {
  const evaluation = evaluateRules(
    {},
    [createRule('required.child'), createRule('required.root', ['required.child'])],
    { scope, selection: { rootRuleIds: ['required.root'] } },
  );
  const report = evaluateRulePolicy({
    evaluation: {
      ...evaluation,
      diagnostics: [],
      plan: {
        ...evaluation.plan,
        diagnostics: [],
        nodes: evaluation.plan.nodes.filter((node) => node.rule.id !== 'required.child'),
      },
    },
    policy: createRequiredPolicy(),
    provenance,
  });

  expect(report.decision).toBe('FAIL');
  expect(report.profiles[0]?.decision).toBe('BLOCK');
  expect(report.profiles[0]?.diagnostics).toEqual([
    expect.objectContaining({ code: 'missing-required-plan-node', ruleId: 'required.child' }),
  ]);
  expect(report.profiles[0]?.results).toMatchObject([
    { rule: { id: 'required.root' }, status: 'PASS' },
  ]);
});

/*** Create a passing rule with an optional direct dependency for plan-integrity coverage. */
function createRule(id: string, dependencyRuleIds: readonly string[] = []): Rule {
  return {
    defaultSeverity: 'error',
    dependencies: dependencyRuleIds.map((ruleId) => ({ ruleId })),
    evaluate: () => ({ findings: [], status: 'PASS' }),
    identity: { id, version: '1.0.0' },
    summary: id,
  };
}

/*** Create the Required profile that must prove the complete planned dependency closure. */
function createRequiredPolicy(): RulePolicy {
  return {
    profiles: [
      {
        id: 'fixture-profile',
        mode: 'required',
        rootRuleIds: ['required.root'],
        severityThreshold: 'error',
        version: '1.0.0',
      },
    ],
  };
}
