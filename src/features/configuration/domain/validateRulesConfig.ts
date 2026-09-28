import { isRecord } from '@ankhorage/utility/object';

import type {
  JsonValue,
  RulesConfig,
  RulesConfigDiagnostic,
  RulesConfigRule,
  RulesConfigValidationOptions,
  RulesConfigValidationResult,
  RuleSeverity,
} from '../../../types/rules.js';

/*** Validate canonical rules.json data, optionally against a concrete rule registry. */
export function validateRulesConfig<TContext>(
  value: unknown,
  options: RulesConfigValidationOptions<TContext> = {},
): RulesConfigValidationResult {
  const structuralResult = validateRulesConfigStructure(value);
  if (structuralResult.config === null) return structuralResult;

  const diagnostics = [
    ...structuralResult.diagnostics,
    ...validateConfiguredRules(structuralResult.config, options),
  ];

  return {
    config: diagnostics.length === 0 ? structuralResult.config : null,
    diagnostics,
  };
}

/*** Validate the JSON-only shape before any provider-specific interpretation occurs. */
function validateRulesConfigStructure(value: unknown): RulesConfigValidationResult {
  if (!isRecord(value)) return invalidConfig('rules.json must contain an object.');
  if (value.version !== 1) return invalidConfig('rules.json "version" must be 1.', 'version');
  if (!Array.isArray(value.rules))
    return invalidConfig('rules.json "rules" must be an array.', 'rules');

  const ruleResults = value.rules.map((rule, index) => validateRulesConfigRule(rule, index));
  const diagnostics = ruleResults.flatMap((result) => result.diagnostics);
  if (diagnostics.length > 0) return { config: null, diagnostics };

  const rules = ruleResults.flatMap((result) => (result.rule === null ? [] : [result.rule]));
  const duplicateIds = findDuplicateRuleIds(rules);
  if (duplicateIds.length > 0) {
    return {
      config: null,
      diagnostics: duplicateIds.map((id) => ({
        code: 'invalid-rule-id',
        message: `rules.json configures rule "${id}" more than once.`,
        path: 'rules',
        ruleId: id,
      })),
    };
  }

  return { config: { version: 1, rules }, diagnostics: [] };
}

/*** Validate one serialized rule selection while retaining its original options exactly. */
function validateRulesConfigRule(
  value: unknown,
  index: number,
): {
  readonly diagnostics: readonly RulesConfigDiagnostic[];
  readonly rule: RulesConfigRule | null;
} {
  const path = `rules[${index}]`;
  if (!isRecord(value)) return invalidRule('invalid-config', path, 'must be an object.');
  if (!isNonEmptyString(value.id))
    return invalidRule('invalid-rule-id', `${path}.id`, 'must define a non-empty "id".');
  if (typeof value.enabled !== 'boolean')
    return invalidRule(
      'invalid-config',
      `${path}.enabled`,
      'must define boolean "enabled".',
      value.id,
    );
  if (value.severity !== undefined && !isRuleSeverity(value.severity)) {
    return invalidRule(
      'invalid-severity',
      `${path}.severity`,
      'has an invalid "severity".',
      value.id,
    );
  }
  if (value.options !== undefined && !isJsonValue(value.options)) {
    return invalidRule(
      'invalid-options',
      `${path}.options`,
      'has non-serializable "options".',
      value.id,
    );
  }

  return {
    diagnostics: [],
    rule: {
      id: value.id,
      enabled: value.enabled,
      ...(value.severity === undefined ? {} : { severity: value.severity }),
      ...(value.options === undefined ? {} : { options: value.options }),
    },
  };
}

/*** Apply optional registry and capability knowledge without creating provider-specific engine paths. */
function validateConfiguredRules<TContext>(
  config: RulesConfig,
  options: RulesConfigValidationOptions<TContext>,
): readonly RulesConfigDiagnostic[] {
  const { registry } = options;
  if (registry === undefined) return [];

  const availableCapabilities = new Set(options.capabilities ?? []);
  return config.rules.reduce<RulesConfigDiagnostic[]>((diagnostics, configuredRule, index) => {
    if (!configuredRule.enabled) return diagnostics;
    const rule = registry.ruleById.get(configuredRule.id);
    if (rule === undefined) {
      return [
        ...diagnostics,
        {
          code: 'unknown-rule',
          message: `rules.json configures unknown rule "${configuredRule.id}".`,
          path: `rules[${index}].id`,
          ruleId: configuredRule.id,
        },
      ];
    }

    const missingCapabilities =
      options.capabilities === undefined
        ? []
        : (rule.requiredCapabilities ?? []).filter(
            (capability) => !availableCapabilities.has(capability),
          );
    const capabilityDiagnostics = missingCapabilities.map((capability) => ({
      code: 'missing-capability' as const,
      message: `Rule "${rule.id}" requires unavailable capability "${capability}".`,
      path: `rules[${index}]`,
      ruleId: rule.id,
    }));
    const optionDiagnostics = (rule.validateOptions?.(configuredRule.options) ?? []).map(
      (diagnostic) => ({
        code: 'invalid-options' as const,
        message: `Rule "${rule.id}": ${diagnostic.message}`,
        ruleId: rule.id,
        ...(diagnostic.path === undefined
          ? {}
          : { path: `rules[${index}].options.${diagnostic.path}` }),
      }),
    );
    return [...diagnostics, ...capabilityDiagnostics, ...optionDiagnostics];
  }, []);
}

/*** Create a consistent structural configuration diagnostic. */
function invalidConfig(message: string, path?: string): RulesConfigValidationResult {
  return {
    config: null,
    diagnostics: [{ code: 'invalid-config', message, ...(path === undefined ? {} : { path }) }],
  };
}

/*** Create a typed structural rule diagnostic at one configured rule location. */
function invalidRule(
  code: 'invalid-config' | 'invalid-options' | 'invalid-rule-id' | 'invalid-severity',
  path: string,
  detail: string,
  ruleId?: string,
): { readonly diagnostics: readonly RulesConfigDiagnostic[]; readonly rule: null } {
  return {
    rule: null,
    diagnostics: [
      {
        code,
        message: `rules.json ${path} ${detail}`,
        path,
        ...(ruleId === undefined ? {} : { ruleId }),
      },
    ],
  };
}

/*** Find duplicate explicit rule selections without relying on object-key ordering. */
function findDuplicateRuleIds(rules: readonly RulesConfigRule[]): readonly string[] {
  const seen = new Set<string>();
  return rules.flatMap((rule) => {
    if (seen.has(rule.id)) return [rule.id];
    seen.add(rule.id);
    return [];
  });
}

/*** Determine whether a value is a supported generic severity. */
function isRuleSeverity(value: unknown): value is RuleSeverity {
  return value === 'error' || value === 'info' || value === 'warning';
}

/*** Determine whether a value can be preserved losslessly in JSON configuration. */
function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

/*** Determine whether a raw configuration field is a non-empty identifier. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
