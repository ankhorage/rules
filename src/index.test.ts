import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isRecord } from '@ankhorage/utility/object';
import { describe, expect, test } from 'bun:test';

import { createRulesRuntimeProvider } from './cli/createRulesRuntimeProvider.js';
import { runCli } from './cli/standalone.js';
import {
  createRuleRegistry,
  evaluateConfiguredRules,
  evaluateRules,
  type JsonValue,
  readRulesConfigAsync,
  resolveRulesStatus,
  type Rule,
  type RuleSet,
  validateRulesConfig,
  validateRulesConfigFileAsync,
  writeRulesConfigAsync,
} from './index.js';

interface ContentContext {
  readonly words: readonly string[];
}

interface ReleaseContext {
  readonly blockers: number;
}

interface FixtureContext extends ContentContext, ReleaseContext {}

const contentRule: Rule<ContentContext, { readonly minimum: number }> = {
  id: 'content.minimum-words',
  summary: 'Require a configurable number of words.',
  defaultSeverity: 'error',
  requiredCapabilities: ['text'] as const,
  validateOptions: (options: JsonValue | undefined) =>
    isMinimumOptions(options)
      ? []
      : [{ code: 'minimum-required', message: 'options.minimum must be a number.' }],
  evaluate({ context, options }) {
    const minimum = isMinimumOptions(options) ? options.minimum : undefined;
    return typeof minimum === 'number' && context.words.length < minimum
      ? [
          {
            ruleId: 'ignored-by-engine',
            severity: 'info',
            message: `Expected at least ${minimum} words.`,
            subjects: [{ id: 'document', kind: 'document' }],
            evidence: { actual: context.words.length, minimum },
          },
        ]
      : [];
  },
};

const releaseRule: Rule<ReleaseContext> = {
  id: 'release.no-blockers',
  summary: 'Report release blockers from a different domain context.',
  defaultSeverity: 'error',
  requiredCapabilities: ['release-state'] as const,
  evaluate({ context }) {
    return context.blockers > 0
      ? [
          {
            ruleId: 'ignored-by-engine',
            severity: 'info',
            message: `${context.blockers} release blocker(s) remain.`,
            subjects: [{ id: 'release', kind: 'release' }],
            evidence: { blockers: context.blockers },
          },
        ]
      : [];
  },
};

const fixtureRuleSets: readonly RuleSet<FixtureContext>[] = [
  { id: 'release-provider', rules: [releaseRule] },
  { id: 'content-provider', rules: [contentRule] },
];

/*** Identify the serializable option object used by the unrelated content fixture provider. */
function isMinimumOptions(value: JsonValue | undefined): value is { readonly minimum: number } {
  return isRecord(value) && typeof value.minimum === 'number';
}

describe('public Rules contract', () => {
  test('composes unrelated providers through one deterministic evaluator', testProviderComposition);
  test('preserves typed structural configuration diagnostics', testStructuralConfigDiagnostics);
  test(
    'validates configured IDs, options, and required capabilities explicitly',
    testInvalidConfigDiagnostics,
  );
  test('applies configured options and severity overrides', testConfiguredRules);
  test('marks evaluation diagnostics as invalid status', testDiagnosticStatus);
  test(
    'reads, validates, writes, and validates the JSON-only configuration through public APIs',
    testConfigFileOperations,
  );
  test('exposes the required provider capability and standalone CLI contract', testCliContract);
});

function testProviderComposition(): void {
  const registry = createRuleRegistry(fixtureRuleSets);
  const result = evaluateRules({ blockers: 1, words: ['one'] }, registry.rules, {
    capabilities: ['text', 'release-state'],
    optionsByRuleId: new Map([['content.minimum-words', { minimum: 2 }]]),
  });

  expect(registry.ruleSets.map((ruleSet) => ruleSet.id)).toEqual([
    'content-provider',
    'release-provider',
  ]);
  expect(result.diagnostics).toEqual([]);
  expect(result.findings.map((finding) => finding.ruleId)).toEqual([
    'content.minimum-words',
    'release.no-blockers',
  ]);
  expect(result.findings[0]?.severity).toBe('error');
}

function testConfiguredRules(): void {
  const registry = createRuleRegistry(fixtureRuleSets);
  const config = {
    version: 1,
    rules: [
      { id: 'content.minimum-words', enabled: true, options: { minimum: 2 } },
      { id: 'release.no-blockers', enabled: true, severity: 'warning' },
    ],
  } as const;

  const result = evaluateConfiguredRules({ blockers: 1, words: ['one'] }, config, registry, {
    capabilities: ['text', 'release-state'],
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.findings.map((finding) => finding.severity)).toEqual(['error', 'warning']);
  expect(resolveRulesStatus(result)).toEqual({ status: 'invalid', color: 'red' });
}

function testStructuralConfigDiagnostics(): void {
  expect(
    validateRulesConfig({
      version: 1,
      rules: [{ id: 'release.no-blockers', enabled: true, severity: 'fatal' }],
    }).diagnostics,
  ).toEqual([expect.objectContaining({ code: 'invalid-severity', ruleId: 'release.no-blockers' })]);

  expect(
    validateRulesConfig({
      version: 1,
      rules: [{ id: 'release.no-blockers', enabled: 'yes' }],
    }).diagnostics,
  ).toEqual([expect.objectContaining({ code: 'invalid-config', ruleId: 'release.no-blockers' })]);
}

function testInvalidConfigDiagnostics(): void {
  const registry = createRuleRegistry(fixtureRuleSets);
  expect(
    validateRulesConfig(
      { version: 1, rules: [{ id: 'release.no-blockers', enabled: true }] },
      { registry, capabilities: ['text'] },
    ).diagnostics.map((diagnostic) => diagnostic.code),
  ).toEqual(['missing-capability']);
  expect(
    validateRulesConfig(
      { version: 1, rules: [{ id: 'missing.rule', enabled: true }] },
      { registry, capabilities: ['text', 'release-state'] },
    ).diagnostics.map((diagnostic) => diagnostic.code),
  ).toEqual(['unknown-rule']);
  expect(
    validateRulesConfig(
      { version: 1, rules: [{ id: 'content.minimum-words', enabled: true, options: {} }] },
      { registry, capabilities: ['text'] },
    ).diagnostics.map((diagnostic) => diagnostic.code),
  ).toEqual(['invalid-options']);
  expect(
    evaluateConfiguredRules(
      { blockers: 0, words: [] },
      { version: 1, rules: [{ id: 'missing.rule', enabled: true }] },
      registry,
      { capabilities: ['text', 'release-state'] },
    ).diagnostics,
  ).toEqual([expect.objectContaining({ code: 'unknown-rule', ruleId: 'missing.rule' })]);
}

function testDiagnosticStatus(): void {
  const registry = createRuleRegistry(fixtureRuleSets);
  const result = evaluateConfiguredRules(
    { blockers: 0, words: [] },
    { version: 1, rules: [{ id: 'missing.rule', enabled: true }] },
    registry,
    { capabilities: ['text', 'release-state'] },
  );

  expect(result.findings).toEqual([]);
  expect(resolveRulesStatus(result)).toEqual({ status: 'invalid', color: 'red' });
}

async function testConfigFileOperations(): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'ankhorage-rules-'));
  const path = join(directory, 'rules.json');
  const config = {
    version: 1,
    rules: [{ id: 'content.minimum-words', enabled: true, options: { minimum: 2 } }],
  } as const;

  try {
    await writeRulesConfigAsync(path, config);
    expect((await readRulesConfigAsync(path)).config).toEqual(config);
    expect((await validateRulesConfigFileAsync(path, directory)).diagnostics).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function testCliContract(): Promise<void> {
  const provider = createRulesRuntimeProvider();
  expect(provider.capabilities).toEqual(['rules.config.validate']);
  expect(JSON.stringify(provider.commands)).toContain(
    '"path":["config","validate"],"capability":"rules.config.validate"',
  );
  expect((await runCli(['--help'])).exitCode).toBe(0);
}
