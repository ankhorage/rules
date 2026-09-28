import type {
  EvaluateConfiguredRulesOptions,
  RuleEvaluationDiagnostic,
  RuleEvaluationResult,
  RuleFinding,
  RuleRegistry,
  RulesConfig,
  RulesConfigDiagnostic,
} from '../../../types/rules.js';
import { validateRulesConfig } from '../../configuration/domain/validateRulesConfig.js';
import { evaluateRules } from './evaluateRules.js';

/*** Resolve a configured Rule registry and evaluate its enabled rules without provider branches. */
export function evaluateConfiguredRules<TContext>(
  context: TContext,
  config: RulesConfig,
  registry: RuleRegistry<TContext>,
  options: EvaluateConfiguredRulesOptions = {},
): RuleEvaluationResult {
  const validation = validateRulesConfig(config, {
    registry,
    capabilities: options.capabilities,
  });
  if (validation.config === null) {
    return {
      findings: [],
      diagnostics: validation.diagnostics.map(toEvaluationDiagnostic),
    };
  }

  const enabledConfigurations = validation.config.rules.filter((rule) => rule.enabled);
  const optionsByRuleId = new Map(
    enabledConfigurations.map((rule) => [rule.id, rule.options] as const),
  );
  const selectedRules = enabledConfigurations.flatMap((configuredRule) => {
    const rule = registry.ruleById.get(configuredRule.id);
    return rule === undefined ? [] : [rule];
  });
  const result = evaluateRules(context, selectedRules, {
    capabilities: options.capabilities,
    optionsByRuleId,
  });

  return {
    diagnostics: result.diagnostics,
    findings: applyConfiguredSeverities(result.findings, validation.config),
  };
}

/*** Translate config validation failures into the evaluator's portable diagnostic shape. */
function toEvaluationDiagnostic(diagnostic: RulesConfigDiagnostic): RuleEvaluationDiagnostic {
  return {
    code:
      diagnostic.code === 'missing-capability'
        ? 'missing-capability'
        : diagnostic.code === 'unknown-rule'
          ? 'unknown-rule'
          : diagnostic.code === 'invalid-options'
            ? 'invalid-options'
            : 'invalid-config',
    ruleId: diagnostic.ruleId ?? 'rules.config',
    message: diagnostic.message,
  };
}

/*** Apply configured severity overrides after providers have produced neutral findings. */
function applyConfiguredSeverities(
  findings: readonly RuleFinding[],
  config: RulesConfig,
): readonly RuleFinding[] {
  const severityByRuleId = new Map(config.rules.map((rule) => [rule.id, rule.severity] as const));
  return findings.map((finding) => ({
    ...finding,
    severity: severityByRuleId.get(finding.ruleId) ?? finding.severity,
  }));
}
