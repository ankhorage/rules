import {
  createDesignRuleProvider,
  type DesignRuleProviderOptions,
  selectDesignRuleProfile,
} from '@ankhorage/rules-design';
import { expect, test } from 'bun:test';

import type {
  RuleEvaluationCache,
  RuleEvaluationResult,
  RulePolicy,
} from '../../../types/rules.js';
import { evaluateRulePolicy } from './evaluateRulePolicy.js';
import { evaluateRules } from './evaluateRules.js';
import {
  createDesignProfileParityFixture,
  type DesignFact,
} from './fixtures/designProfileParityFixture.js';

const fixture = createDesignProfileParityFixture();
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

test('proves PHP and Studio Golden outputs have genuine adapter hashes and distinct provenance', () => {
  assertAdapterOutput(fixture.phpFacts, 'ankhorage-wordpress');
  assertAdapterOutput(fixture.studioFacts, '@ankhorage/studio');

  expect(fixture.scenario.adapterSources.php.boundary).toBe(
    'ANK_Design_Facts::color_usage_from_capture',
  );
  expect(fixture.scenario.adapterSources.studio.boundary).toBe('createStudioDesignFacts');
  expect(fixture.phpFacts[0]?.scope.target.kind).toBe('wordpress-page');
  expect(fixture.studioFacts[0]?.scope.target.kind).toBe('studio-screen');
  expect(fixture.phpFacts[0]?.contentHash).not.toBe(fixture.studioFacts[0]?.contentHash);
  expect(fixture.portableFacts(fixture.phpFacts)).toEqual(
    fixture.portableFacts(fixture.studioFacts),
  );
});

test('keeps selection, closure, outcomes, and findings equal for both mandatory profiles', () => {
  for (const profileId of ['design.crap', 'design.60-30-10'] as const) {
    const phpResult = evaluateProfile(
      profileId,
      fixture.evaluationFacts(fixture.phpFacts),
      'tenant-a',
      'catalog',
    );
    const studioResult = evaluateProfile(
      profileId,
      fixture.evaluationFacts(fixture.studioFacts),
      'tenant-a',
      'catalog',
    );

    expect(phpResult.plan).toEqual(studioResult.plan);
    expect(phpResult.results).toEqual(studioResult.results);
    expect(phpResult.findings).toEqual(studioResult.findings);
    expect(fixture.contentHash(phpResult)).toBe(fixture.contentHash(studioResult));
  }

  const distribution = evaluateProfile(
    'design.60-30-10',
    fixture.evaluationFacts(fixture.phpFacts),
    'tenant-a',
    'catalog',
  );
  expect(distribution.results[0]).toMatchObject({
    rule: { id: 'design.color.usage-distribution', version: '1.0.0' },
    status: 'PASS',
  });
  expect(distribution.findings).toHaveLength(36);
  expect(
    evaluateProfile(
      'design.crap',
      fixture.evaluationFacts(fixture.phpFacts),
      'tenant-a',
      'catalog',
    ).results.find((result) => result.rule.id === 'design.crap')?.status,
  ).toBe('INCOMPLETE');
});

test('keeps supplemental viewport and scroll diagnostics non-blocking for a complete page', () => {
  const evaluation = evaluateProfile(
    'design.60-30-10',
    fixture.evaluationFacts(fixture.phpFacts),
    'tenant-a',
    'catalog',
  );
  const required = evaluateRulePolicy({
    evaluation,
    policy: createRulePolicy('required'),
    provenance: policyProvenance(fixture.phpFacts),
  });

  expect(required.decision).toBe('PASS');
  expect(evaluation.findings).toHaveLength(36);
});

test('fails closed for missing page evidence while advisory remains non-blocking', () => {
  const facts = fixture
    .evaluationFacts(fixture.phpFacts)
    .filter(
      (fact) =>
        !(
          fact.value.breakpointId === 'mobile' &&
          fact.value.scope === 'page' &&
          fact.value.themeId === 'dark'
        ),
    );
  const evaluation = evaluateProfile('design.60-30-10', facts, 'tenant-a', 'catalog');
  const required = evaluateRulePolicy({
    evaluation,
    policy: createRulePolicy('required'),
    provenance: policyProvenance(facts),
  });
  const advisory = evaluateRulePolicy({
    evaluation,
    policy: createRulePolicy('advisory'),
    provenance: policyProvenance(facts),
  });

  expect(evaluation.results[0]?.status).toBe('INCOMPLETE');
  expect(required.decision).toBe('FAIL');
  expect(advisory.decision).toBe('PASS');
  expect(advisory.profiles[0]?.decision).toBe('ADVISORY');
});

test('isolates same project and scope identities by host-authenticated tenant partitions', () => {
  const cache = fixture.createCache();
  const tenantA = evaluateProfile(
    'design.60-30-10',
    fixture.evaluationFacts(fixture.phpFacts),
    'tenant-a',
    'catalog',
    cache.cache,
  );
  const tenantB = evaluateProfile(
    'design.60-30-10',
    fixture
      .evaluationFacts(fixture.studioFacts)
      .filter(
        (fact) =>
          !(
            fact.value.breakpointId === 'desktop' &&
            fact.value.scope === 'page' &&
            fact.value.themeId === 'light'
          ),
      ),
    'tenant-b',
    'catalog',
    cache.cache,
  );
  const untrustedTenantOverride = fixture.evaluationFacts(fixture.studioFacts).map((fact) => ({
    ...fact,
    scope: { ...fact.scope, target: { ...fact.scope.target, tenantId: 'tenant-b' } },
  }));
  evaluateProfile('design.60-30-10', untrustedTenantOverride, 'tenant-a', 'catalog', cache.cache);

  expect(tenantA.results[0]).toMatchObject({ execution: 'evaluated', status: 'PASS' });
  expect(tenantB.results[0]).toMatchObject({ execution: 'evaluated', status: 'INCOMPLETE' });
  expect(tenantA.results[0]?.scope).toEqual(tenantB.results[0]?.scope);
  expect(cache.keys.map((key) => key.partition.tenantId)).toContain('tenant-a');
  expect(cache.keys.map((key) => key.partition.tenantId)).toContain('tenant-b');
  expect(cache.keys.at(-1)?.partition).toEqual({ projectId: 'catalog', tenantId: 'tenant-a' });
});

/*** Evaluate one released Design profile through the generic Rules boundary and an authenticated cache partition. */
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
    factsVersion: fixture.factsVersion,
    scope: fixture.scope,
    selection: selectDesignRuleProfile(profileId).selection,
  });
}

/*** Verify Golden facts came from a distinct adapter and retained its adapter-owned canonical digest. */
function assertAdapterOutput(facts: readonly DesignFact[], producerId: string): void {
  expect(facts).toHaveLength(18);
  expect(new Set(facts.map((fact) => fact.provenance.producer.id))).toEqual(new Set([producerId]));
  expect(new Set(facts.map((fact) => fact.value.breakpointId))).toEqual(
    new Set(['desktop', 'tablet', 'mobile']),
  );
  expect(new Set(facts.map((fact) => fact.value.themeId))).toEqual(new Set(['light', 'dark']));
  expect(new Set(facts.map((fact) => fact.value.scope))).toEqual(
    new Set(['page', 'scroll-sample', 'viewport']),
  );
  for (const fact of facts) {
    const { contentHash: expectedHash, ...hashable } = fact;
    expect(expectedHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(expectedHash).toBe(fixture.contentHash(hashable));
  }
}

/*** Create policy provenance from the same stable serialization used by the adapter fact digests. */
function policyProvenance(facts: readonly DesignFact[]) {
  return {
    commitSha: 'fixture-commit',
    configHash: fixture.contentHash(policy),
    factsHash: fixture.contentHash(facts),
  };
}

/*** Create a policy whose selected root uses Required or advisory behavior without changing provider configuration. */
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
