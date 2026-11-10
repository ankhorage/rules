import { createHash } from 'node:crypto';

import type { AvailableFactEnvelope } from '@ankhorage/contracts/rules';
import { isRecord } from '@ankhorage/utility/object';

import type {
  RuleEvaluationCache,
  RuleEvaluationCacheKey,
  RuleResult,
} from '../../../../types/rules.js';
import inputScenario from './design-profile-parity/v1/input.json';
import studioAdapterOutput from './design-profile-parity/v1/studio-output.json';
import phpAdapterOutput from './design-profile-parity/v1/wordpress-output.json';

const scope = { id: 'landing', kind: 'page' } as const;

interface DesignValue {
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
}

export type DesignFact = AvailableFactEnvelope & { readonly value: DesignValue };

/*** Expose versioned, independent PHP and Studio Golden outputs plus their portable normalization. */
export function createDesignProfileParityFixture() {
  const phpFacts = readDesignFacts(phpAdapterOutput);
  const studioFacts = readDesignFacts(studioAdapterOutput);

  return {
    contentHash,
    createCache,
    evaluationFacts,
    factsVersion: 'design-fixtures/v1',
    phpFacts,
    portableFacts,
    scenario: inputScenario,
    scope,
    studioFacts,
  };
}

/*** Retain only portable adapter evidence for cross-platform parity; native provenance remains separately asserted. */
function portableFacts(facts: readonly DesignFact[]): readonly unknown[] {
  return facts
    .map((fact) =>
      sortValue({
        kind: fact.kind,
        schemaVersion: fact.schemaVersion,
        status: fact.status,
        value: fact.value,
      }),
    )
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

/*** Normalize platform-specific fact identities into the shared evaluation scope without merging evidence scopes. */
function evaluationFacts(facts: readonly DesignFact[]): readonly DesignFact[] {
  return facts.map((fact) => {
    const normalized = {
      id: `${fact.kind}:${fact.value.breakpointId}:${fact.value.themeId}:${fact.value.scope}:${fact.value.scopeId}`,
      kind: fact.kind,
      provenance: {
        collectedAt: '2026-11-10T00:00:00.000Z',
        producer: { id: 'design-fixture-normalization', version: 'design-fixtures/v1' },
        source: { id: 'design-fixtures', revision: 'v1' },
      },
      schemaVersion: 1 as const,
      scope: {
        ...scope,
        target: {
          kind: 'application',
          projectId: 'catalog',
          targetId: 'landing',
          tenantId: 'tenant-a',
        },
      },
      status: 'available' as const,
      value: fact.value,
    };

    return { ...normalized, contentHash: contentHash(normalized) };
  });
}

/*** Capture exact evaluator cache keys so isolation assertions inspect the Rules-owned identity. */
function createCache(): {
  readonly cache: RuleEvaluationCache;
  readonly keys: RuleEvaluationCacheKey[];
} {
  const entries = new Map<string, RuleResult>();
  const keys: RuleEvaluationCacheKey[] = [];
  return {
    cache: {
      read(key): RuleResult | undefined {
        keys.push(key);
        return entries.get(JSON.stringify(key));
      },
      write(key, result): void {
        keys.push(key);
        entries.set(JSON.stringify(key), result);
      },
    },
    keys,
  };
}

/*** Match the adapter-defined canonical content digest: recursively sorted JSON followed by SHA-256. */
function contentHash(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex')}`;
}

/*** Read only complete rendered-area envelope fixtures; malformed Golden data fails this contract immediately. */
function readDesignFacts(value: unknown): readonly DesignFact[] {
  if (!Array.isArray(value) || !value.every(isDesignFact))
    throw new Error('Invalid Design adapter Golden fixture.');
  return value;
}

/*** Recognize the portable fields required by the Design color-distribution adapter contract. */
function isDesignFact(value: unknown): value is DesignFact {
  return isAvailableDesignEnvelope(value) && isDesignValue(value.value);
}

/*** Recognize the available envelope fields shared by both adapter outputs. */
function isAvailableDesignEnvelope(value: unknown): value is Readonly<Record<string, unknown>> & {
  readonly value: Readonly<Record<string, unknown>>;
} {
  return (
    isRecord(value) &&
    typeof value.contentHash === 'string' &&
    typeof value.id === 'string' &&
    value.kind === 'design.color.usage-distribution' &&
    value.schemaVersion === 1 &&
    value.status === 'available' &&
    isRecord(value.provenance) &&
    isRecord(value.scope) &&
    isRecord(value.value)
  );
}

/*** Recognize the complete portable rendered-area value carried by an available fact. */
function isDesignValue(value: Readonly<Record<string, unknown>>): boolean {
  return (
    typeof value.breakpointId === 'string' &&
    typeof value.measuredPixels === 'number' &&
    isRolePixels(value.rolePixels) &&
    isEvidenceScope(value.scope) &&
    typeof value.scopeId === 'string' &&
    typeof value.themeId === 'string' &&
    typeof value.unknownPixels === 'number'
  );
}

/*** Recognize the four exclusive color-area counters required by the portable Design fact. */
function isRolePixels(value: unknown): value is DesignValue['rolePixels'] {
  return (
    isRecord(value) &&
    typeof value.accent === 'number' &&
    typeof value.base === 'number' &&
    typeof value.secondary === 'number' &&
    typeof value.unknown === 'number'
  );
}

/*** Limit fixture evidence to the three separately evaluated scope categories. */
function isEvidenceScope(value: unknown): value is DesignValue['scope'] {
  return value === 'page' || value === 'scroll-sample' || value === 'viewport';
}

/*** Sort object keys recursively while preserving semantically ordered arrays. */
function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  return value;
}
