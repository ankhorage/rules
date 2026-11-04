import { describe, expect, test } from 'bun:test';

import type { Rule } from '../../../types/rules.js';
import { validateRulesConfig } from '../../configuration/domain/validateRulesConfig.js';
import { createRuleRegistry } from './createRuleRegistry.js';
import { evaluateConfiguredRules } from './evaluateConfiguredRules.js';
import { evaluateRules } from './evaluateRules.js';

interface FixtureContext {
  readonly value: string;
}

const fixtureScope = { id: 'fixture-project', kind: 'project' } as const;

describe('evaluateRules', defineEvaluateRulesTests);

function defineEvaluateRulesTests(): void {
  test(
    'contains provider evaluation exceptions without stopping independent rules',
    testRuleErrors,
  );
  test(
    'contains provider option validation exceptions during configured validation',
    testOptionErrors,
  );
}

function testRuleErrors(): void {
  const passingRule = createPassingRule();
  const throwingRule = createThrowingRule('content.throwing', 'evaluation');
  const throwingOptionsRule = createThrowingRule('content.throwing-options-direct', 'options');
  const result = evaluateRules(
    { value: 'fixture' },
    [throwingRule, passingRule, throwingOptionsRule],
    { scope: fixtureScope },
  );

  expect(result.results).toEqual([
    expect.objectContaining({
      diagnostics: [],
      rule: passingRule.identity,
      scope: fixtureScope,
      status: 'PASS',
    }),
    expect.objectContaining({
      diagnostics: [
        {
          code: 'rule-error',
          message: 'Rule "content.throwing" threw while the evaluator invoked it.',
          ruleId: 'content.throwing',
        },
      ],
      findings: [],
      rule: throwingRule.identity,
      scope: fixtureScope,
      status: 'ERROR',
    }),
    expect.objectContaining({
      diagnostics: [
        {
          code: 'rule-error',
          message: 'Rule "content.throwing-options-direct" threw while the evaluator invoked it.',
          ruleId: 'content.throwing-options-direct',
        },
      ],
      findings: [],
      rule: throwingOptionsRule.identity,
      scope: fixtureScope,
      status: 'ERROR',
    }),
  ]);
  expect(result.findings).toEqual([]);
}

function testOptionErrors(): void {
  const throwingOptionsRule: Rule<FixtureContext> = {
    identity: { id: 'content.throwing-options', version: '1.0.0' },
    summary: 'Throw from option validation.',
    defaultSeverity: 'error',
    dependencies: [],
    validateOptions: () => {
      throw new Error('provider detail must not become a configuration contract');
    },
    evaluate: () => ({ status: 'PASS', findings: [] }),
  };
  const registry = createRuleRegistry([
    { id: 'throwing-options-provider', rules: [throwingOptionsRule] },
  ]);
  const config = {
    version: 1,
    rules: [{ id: 'content.throwing-options', enabled: true, options: {} }],
  } as const;

  expect(validateRulesConfig(config, { registry })).toEqual({
    config: null,
    diagnostics: [
      {
        code: 'rule-error',
        message: 'Rule "content.throwing-options" threw while validating its options.',
        path: 'rules[0].options',
        ruleId: 'content.throwing-options',
      },
    ],
  });
  expect(
    evaluateConfiguredRules({ value: 'fixture' }, config, registry, { scope: fixtureScope }),
  ).toEqual({
    findings: [],
    diagnostics: [
      {
        code: 'rule-error',
        message: 'Rule "content.throwing-options" threw while validating its options.',
        ruleId: 'content.throwing-options',
      },
    ],
    results: [],
  });
}

function createThrowingRule(
  id: string,
  throwingOperation: 'evaluation' | 'options',
): Rule<FixtureContext> {
  return {
    identity: { id, version: '1.0.0' },
    summary: `Throw from ${throwingOperation}.`,
    defaultSeverity: 'error',
    dependencies: [],
    ...(throwingOperation === 'options'
      ? {
          validateOptions: () => {
            throw new Error('provider detail must not become an evaluator contract');
          },
        }
      : {}),
    evaluate:
      throwingOperation === 'evaluation'
        ? () => {
            throw new Error('provider detail must not become an evaluator contract');
          }
        : () => ({ status: 'PASS', findings: [] }),
  };
}

function createPassingRule(): Rule<FixtureContext> {
  return {
    identity: { id: 'content.passing', version: '1.0.0' },
    summary: 'Complete independently.',
    defaultSeverity: 'info',
    dependencies: [],
    evaluate: () => ({ status: 'PASS', findings: [] }),
  };
}
