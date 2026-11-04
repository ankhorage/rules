import { expect, test } from 'bun:test';

import { evaluateRules, type Rule, type RuleEvaluationInput } from './index.js';

interface FixtureContext {
  readonly hasEvidence: boolean;
}

test('freezes composable rule identities, statuses, scopes, and dependency input', () => {
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
  expect(
    evaluateRules({ hasEvidence: true }, [dependentRule], {
      scope: { id: 'fixture-project', kind: 'project' },
    }).diagnostics,
  ).toEqual([
    expect.objectContaining({
      code: 'unresolved-dependencies',
      ruleId: 'release.requires-content',
    }),
  ]);
});
