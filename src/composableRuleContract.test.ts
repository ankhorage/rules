import { expect, test } from 'bun:test';

import { evaluateRules, resolveRulesStatus, type Rule, type RuleEvaluationInput } from './index.js';

interface FixtureContext {
  readonly hasEvidence: boolean;
}

test('preserves provider PASS, FAIL, and INCOMPLETE statuses without findings', () => {
  const rules: readonly Rule<FixtureContext>[] = [
    createStatusRule('content.pass', 'PASS'),
    createStatusRule('content.fail', 'FAIL'),
    createStatusRule('content.incomplete', 'INCOMPLETE'),
  ];

  const result = evaluateRules({ hasEvidence: true }, rules, {
    scope: { id: 'fixture-project', kind: 'project' },
  });

  expect(result.diagnostics).toEqual([]);
  expect(result.findings).toEqual([]);
  expect(result.results.map((rule) => [rule.rule.id, rule.status])).toEqual([
    ['content.fail', 'FAIL'],
    ['content.incomplete', 'INCOMPLETE'],
    ['content.pass', 'PASS'],
  ]);
  expect(resolveRulesStatus(result)).toEqual({ status: 'invalid', color: 'red' });
});

test('fails closed for unresolved dependencies without evaluating the provider', () => {
  const dependentRule: Rule<FixtureContext> = {
    identity: { id: 'release.requires-content', version: '2.0.0' },
    summary: 'Require a completed content dependency.',
    defaultSeverity: 'warning',
    dependencies: [{ ruleId: 'content.minimum-words' }],
    facets: [{ id: 'kind', value: 'advisory' }],
    evaluate: ({ context, dependencyResults }: RuleEvaluationInput<FixtureContext>) => ({
      status:
        context.hasEvidence && dependencyResults.every((result) => result.status === 'PASS')
          ? 'PASS'
          : 'INCOMPLETE',
      findings: [],
    }),
  };

  expect(dependentRule.identity).toEqual({ id: 'release.requires-content', version: '2.0.0' });
  expect(dependentRule.dependencies).toEqual([{ ruleId: 'content.minimum-words' }]);
  expect(dependentRule.facets).toEqual([{ id: 'kind', value: 'advisory' }]);
  const result = evaluateRules({ hasEvidence: true }, [dependentRule], {
    scope: { id: 'fixture-project', kind: 'project' },
  });

  expect(result.diagnostics).toEqual([
    expect.objectContaining({
      code: 'unresolved-dependencies',
      ruleId: 'release.requires-content',
    }),
  ]);
  expect(result.findings).toEqual([]);
  expect(result.results).toEqual([
    expect.objectContaining({ rule: dependentRule.identity, status: 'INCOMPLETE' }),
  ]);
  expect(resolveRulesStatus(result)).toEqual({ status: 'invalid', color: 'red' });
});

function createStatusRule(
  id: string,
  status: 'FAIL' | 'INCOMPLETE' | 'PASS',
): Rule<FixtureContext> {
  return {
    identity: { id, version: '1.0.0' },
    summary: `Return ${status} without findings.`,
    defaultSeverity: 'info',
    dependencies: [],
    evaluate: () => ({ status, findings: [] }),
  };
}
