import { createHash } from 'node:crypto';

import type { AvailableFactEnvelope } from '@ankhorage/contracts/rules';
import {
  createDesignRuleProvider,
  type DesignRuleProviderOptions,
  selectDesignRuleProfile,
} from '@ankhorage/rules-design';
import { expect, test } from 'bun:test';

import type {
  RuleEvaluationCache,
  RuleEvaluationCacheKey,
  RuleEvaluationResult,
  RulePolicy,
  RuleResult,
} from '../../../types/rules.js';
import { evaluateRulePolicy } from './evaluateRulePolicy.js';
import { evaluateRules } from './evaluateRules.js';

const scope = { id: 'landing', kind: 'page' } as const;
const factsVersion = 'design-fixtures/v1';
const policy: DesignRuleProviderOptions = {
  color: {
    alphaCompositions: { 'ink/alpha': { 'surface/base': 'ink/on-base' } },
    allowedColorSyntaxes: ['hex', 'token'],
    allowedTokens: ['text/default', 'surface/base'],
    canonicalLiterals: { '#ffffff': 'surface/base' },
    knownTokens: ['text/default', 'surface/base', 'ink/alpha', 'ink/on-base'],
    rampTokens: { blue: ['blue/100', 'blue/500'] },
    requiredBreakpointIds: ['desktop', 'tablet', 'mobile'],
    requiredScopes: ['page', 'viewport', 'scroll-sample'],
    requiredThemeIds: ['light', 'dark'],
    roleTargets: { accent: 0.1, base: 0.6, secondary: 0.3 },
    roleTolerances: { accent: 0.05, base: 0.05, secondary: 0.05 },
    semanticRoleTokens: { foreground: ['text/default'], background: ['surface/base'] },
    stateTokens: { active: {}, disabled: {}, hover: {} },
    surfaceRoleTokens: { canvas: ['surface/base'] },
    themeTokens: { 'surface/base': ['light'] },
    version: 1,
  },
  typography: {
    allowedFontFamilies: ['Inter'],
    allowedFontSizes: [16, 24, 32],
    allowedFontWeights: ['400', '700'],
    allowedLetterSpacings: [0],
    allowedLineHeights: [20, 30, 40],
    allowedSemanticStyles: { h1: ['display'], h2: ['section'] },
    allowedSpacingAfter: [16],
    allowedSpacingBefore: [24],
    maximumH1Count: 1,
    maximumParagraphMeasure: 75,
    minimumBodyFontSize: 16,
    minimumH1Count: 1,
    minimumParagraphMeasure: 45,
    responsiveFontSizes: { body: [16], hero: [32], section: [24] },
  },
};
const provider = createDesignRuleProvider(policy);

test('keeps versioned PHP and TypeScript fixtures deterministic across both mandatory profiles', () => {
  const phpFacts = createDesignFacts('tenant-a', 'project-a');
  const typeScriptFacts = structuredClone(phpFacts);

  expect(hash(phpFacts)).toBe(hash(typeScriptFacts));

  for (const profileId of ['design.crap', 'design.60-30-10'] as const) {
    const phpResult = evaluateProfile(profileId, phpFacts, 'tenant-a', 'project-a');
    const typeScriptResult = evaluateProfile(profileId, typeScriptFacts, 'tenant-a', 'project-a');

    expect(typeScriptResult).toEqual(phpResult);
    expect(hash(typeScriptResult.results)).toBe(hash(phpResult.results));
    expect(hash(typeScriptResult.findings)).toBe(hash(phpResult.findings));
  }

  const distribution = evaluateProfile('design.60-30-10', phpFacts, 'tenant-a', 'project-a');
  expect(distribution.results).toEqual([
    expect.objectContaining({
      rule: { id: 'design.color.usage-distribution', version: '1.0.0' },
      status: 'PASS',
    }),
  ]);
  expect(distribution.findings).toHaveLength(36);

  const crap = evaluateProfile('design.crap', phpFacts, 'tenant-a', 'project-a');
  expect(crap.results.find((result) => result.rule.id === 'design.crap')?.status).toBe(
    'INCOMPLETE',
  );
});

test('fails closed for a missing required full-page sample while advisory policy remains non-blocking', () => {
  const facts = createDesignFacts('tenant-a', 'project-a').filter(
    (fact) =>
      !(
        fact.value.breakpointId === 'mobile' &&
        fact.value.scope === 'page' &&
        fact.value.themeId === 'dark'
      ),
  );
  const evaluation = evaluateProfile('design.60-30-10', facts, 'tenant-a', 'project-a');
  const required = evaluateRulePolicy({
    evaluation,
    policy: createRulePolicy('required'),
    provenance: { commitSha: 'fixture-commit', configHash: hash(policy), factsHash: hash(facts) },
  });
  const advisory = evaluateRulePolicy({
    evaluation,
    policy: createRulePolicy('advisory'),
    provenance: { commitSha: 'fixture-commit', configHash: hash(policy), factsHash: hash(facts) },
  });

  expect(evaluation.results[0]?.status).toBe('INCOMPLETE');
  expect(required.decision).toBe('FAIL');
  expect(advisory.decision).toBe('PASS');
  expect(advisory.profiles[0]?.decision).toBe('ADVISORY');
});

test('partitions identical scope identities by authenticated tenant and project cache keys', () => {
  const cache = createCache();
  const tenantA = evaluateProfile(
    'design.60-30-10',
    createDesignFacts('tenant-a', 'project-a'),
    'tenant-a',
    'project-a',
    cache,
  );
  const tenantB = evaluateProfile(
    'design.60-30-10',
    createDesignFacts('tenant-b', 'project-b').filter(
      (fact) =>
        !(
          fact.value.breakpointId === 'desktop' &&
          fact.value.scope === 'page' &&
          fact.value.themeId === 'light'
        ),
    ),
    'tenant-b',
    'project-b',
    cache,
  );

  expect(tenantA.results[0]).toMatchObject({ execution: 'evaluated', status: 'PASS' });
  expect(tenantB.results[0]).toMatchObject({ execution: 'evaluated', status: 'INCOMPLETE' });
  expect(tenantB.results[0]?.scope).toEqual(scope);
});

/*** Evaluate one released Design profile through the generic Rules boundary and its authenticated cache partition. */
function evaluateProfile(
  profileId: 'design.crap' | 'design.60-30-10',
  facts: readonly DesignFact[],
  tenantId: string,
  projectId: string,
  cache?: RuleEvaluationCache,
): RuleEvaluationResult {
  return evaluateRules({ facts }, provider.ruleSet.rules, {
    ...(cache === undefined ? {} : { cache }),
    cachePartition: { projectId, tenantId },
    capabilities: ['rendered.area-analysis'],
    factsVersion,
    scope,
    selection: selectDesignRuleProfile(profileId).selection,
  });
}

/*** Create the fixed, portable rendered-area fixture shared verbatim by PHP and TypeScript adapters. */
function createDesignFacts(tenantId: string, projectId: string): readonly DesignFact[] {
  return ['desktop', 'tablet', 'mobile'].flatMap((breakpointId) =>
    ['light', 'dark'].flatMap((themeId) => [
      createFact(tenantId, projectId, breakpointId, themeId, 'page', 'document', {
        accent: 10,
        base: 60,
        secondary: 30,
      }),
      createFact(tenantId, projectId, breakpointId, themeId, 'viewport', 'hero', {
        accent: 50,
        base: 30,
        secondary: 20,
      }),
      createFact(tenantId, projectId, breakpointId, themeId, 'scroll-sample', 'footer', {
        accent: 50,
        base: 30,
        secondary: 20,
      }),
    ]),
  );
}

/*** Create one complete, exclusive visible-area observation without merging page, viewport, or scroll evidence. */
function createFact(
  tenantId: string,
  projectId: string,
  breakpointId: string,
  themeId: string,
  coverageScope: 'page' | 'scroll-sample' | 'viewport',
  scopeId: string,
  rolePixels: { readonly accent: number; readonly base: number; readonly secondary: number },
): DesignFact {
  return {
    contentHash: `sha256:${breakpointId}:${themeId}:${coverageScope}:${scopeId}:${rolePixels.accent}:${rolePixels.base}:${rolePixels.secondary}`,
    id: `design.color.usage-distribution:${breakpointId}:${themeId}:${coverageScope}:${scopeId}`,
    kind: 'design.color.usage-distribution',
    provenance: {
      collectedAt: '2026-11-10T00:00:00.000Z',
      producer: { id: 'design-fixture', version: factsVersion },
      source: { id: 'design-fixture', revision: 'v1' },
    },
    schemaVersion: 1,
    scope: {
      ...scope,
      target: { kind: 'application', projectId, targetId: 'landing', tenantId },
    },
    status: 'available',
    value: {
      breakpointId,
      measuredPixels: 100,
      rolePixels: { ...rolePixels, unknown: 0 },
      scope: coverageScope,
      scopeId,
      themeId,
      unknownPixels: 0,
    },
  };
}

/*** Create one policy whose selected root uses Required or advisory behavior without changing provider configuration. */
function createRulePolicy(mode: 'advisory' | 'required'): RulePolicy {
  return {
    profiles: [
      {
        id: 'design.60-30-10',
        mode,
        rootRuleIds: ['design.color.usage-distribution'],
        severityThreshold: 'error',
        version: '1.0.0',
      },
    ],
  };
}

/*** Create deterministic in-memory storage whose identity is entirely defined by the generic cache key. */
function createCache(): RuleEvaluationCache {
  const entries = new Map<string, RuleResult>();
  return {
    read(key: RuleEvaluationCacheKey): RuleResult | undefined {
      return entries.get(hash(key));
    },
    write(key: RuleEvaluationCacheKey, result: RuleResult): void {
      entries.set(hash(key), result);
    },
  };
}

/*** Hash a serializable fixture or result with stable JSON serialization for cross-adapter parity assertions. */
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

type DesignFact = AvailableFactEnvelope & {
  readonly value: {
    readonly breakpointId: string;
    readonly measuredPixels: number;
    readonly rolePixels: {
      readonly accent: number;
      readonly base: number;
      readonly secondary: number;
      readonly unknown: number;
    };
    readonly scope: 'page' | 'scroll-sample' | 'viewport';
    readonly scopeId: string;
    readonly themeId: string;
    readonly unknownPixels: number;
  };
};
